/**
 * Creación de una nueva solicitud de firma (eIDAS) desde código del servidor.
 *
 * Este helper NO valida que el llamador sea admin/director. Es responsabilidad
 * del caller verificar que la acción es legítima (por ejemplo: el empleado se
 * está dando de baja y firma su propia carta de baja voluntaria).
 *
 * Replica el flujo del server action `crearFirma` (firmas-actions.ts) pero
 * acepta los datos como parámetros tipados en vez de FormData.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256, generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";
import { registrarEvento } from "@/features/rrhh/services/firmas/audit";
import { enviarInvitacionFirma } from "@/features/rrhh/services/firmas/email";

const BUCKET = "firmas";
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MODALIDADES = ["click_to_sign", "email_otp", "manuscrita_digital"] as const;

export type ModalidadFirma = (typeof MODALIDADES)[number];

export interface CrearFirmaInternoInput {
  empresaId: string;
  empleadoId: string;
  pdf: Buffer;
  titulo: string;
  tipo: string;
  modalidad: ModalidadFirma;
  validez?: "eidas_simple" | "eidas_avanzada" | "eidas_cualificada";
  plazoDias?: number;
  observaciones?: string | null;
  /** UUID que se guarda en `enviado_por`. Para autosolicitudes (baja voluntaria) usar el user_id del propio empleado. */
  enviadoPorUserId: string;
  /**
   * Si true, el email de firma se manda al email PERSONAL del empleado (el de su
   * candidatura), y solo si no lo tiene cae al de empresa. Se usa en el onboarding
   * (contrato interno): es un documento personal del trabajador y debe llegarle a
   * su correo, no al corporativo que pueda haber heredado. Default false (compat:
   * empresa primero, luego personal).
   */
  preferirEmailPersonal?: boolean;
  /** Nombre que se muestra en el email de invitación. */
  enviadoPorNombre: string;
  /** Para audit log (opcional). */
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Personalización opcional del correo de invitación (PRP-070): asunto e intro
   * tomados de una plantilla editable. Si no se pasan, se usa el correo estándar.
   */
  emailAsunto?: string | null;
  emailIntro?: string | null;
  /**
   * Posición por defecto de la firma (PRP-070): { pagina, xPct, yPct, anchoPct }.
   * Si se pasa, la pantalla de firma coloca la firma YA POSICIONADA y FIJA (el
   * candidato no la arrastra). Null = el candidato la coloca a mano (compat).
   */
  posicionFirmaDefault?: { pagina: number; xPct: number; yPct: number; anchoPct: number } | null;
}

export type CrearFirmaInternoResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

export async function crearFirmaInterno(
  input: CrearFirmaInternoInput,
): Promise<CrearFirmaInternoResult> {
  try {
    const {
      empresaId,
      empleadoId,
      pdf,
      titulo,
      tipo,
      modalidad,
      validez = "eidas_simple",
      observaciones = null,
      enviadoPorUserId,
      enviadoPorNombre,
      ip = null,
      userAgent = null,
    } = input;

    const plazoDias = Math.max(1, Math.min(60, input.plazoDias ?? 7));

    if (!Buffer.isBuffer(pdf) || pdf.length === 0) {
      return { ok: false, error: "PDF vacío o inválido" };
    }
    if (pdf.length > MAX_PDF_BYTES) {
      return { ok: false, error: "El PDF supera 10 MB" };
    }
    if (!empleadoId) return { ok: false, error: "Falta empleado destinatario" };
    if (!titulo) return { ok: false, error: "Falta el título del documento" };
    if (!(MODALIDADES as readonly string[]).includes(modalidad)) {
      return { ok: false, error: "Modalidad no soportada" };
    }

    const admin = createAdminClient();

    const { data: emp, error: empErr } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, email_empresa, email_personal, empresa_id, estado")
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr || !emp) return { ok: false, error: "Empleado no encontrado" };
    if (emp.empresa_id !== empresaId) {
      return { ok: false, error: "El empleado no pertenece a esa empresa" };
    }

    const emailEmpresa = emp.email_empresa as string | null;
    const emailPersonal = emp.email_personal as string | null;
    const destino = input.preferirEmailPersonal
      ? emailPersonal || emailEmpresa
      : emailEmpresa || emailPersonal;
    if (!destino) {
      return { ok: false, error: "El empleado no tiene email para recibir la firma" };
    }

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url")
      .eq("id", empresaId)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "Tu empresa";
    const empresaLogoUrl = (empresa?.logo_url as string | null) ?? null;

    const sha256Original = sha256(pdf);

    const ahora = new Date();
    const expira = new Date(ahora.getTime() + plazoDias * 86_400_000);

    const { data: docIns, error: docErr } = await admin
      .from("firmas_documentos")
      .insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        titulo,
        tipo,
        modalidad,
        validez,
        estado: "pendiente",
        pdf_original_path: "pending",
        sha256_original: sha256Original,
        enviado_por: enviadoPorUserId,
        enviado_en: ahora.toISOString(),
        expira_en: expira.toISOString(),
        observaciones,
        posicion_firma_default: input.posicionFirmaDefault ?? null,
      })
      .select("id")
      .single();
    if (docErr || !docIns) {
      return { ok: false, error: docErr?.message ?? "No se pudo registrar el documento" };
    }
    const documentoId = docIns.id as string;
    const path = `${empresaId}/${documentoId}/original.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, pdf, { upsert: false, contentType: "application/pdf" });
    if (upErr) {
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `Subida a Storage falló: ${upErr.message}` };
    }

    const { error: updErr } = await admin
      .from("firmas_documentos")
      .update({ pdf_original_path: path })
      .eq("id", documentoId);
    if (updErr) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: updErr.message };
    }

    await registrarEvento({
      documentoId,
      tipo: "creado",
      actorUserId: enviadoPorUserId,
      ip,
      userAgent,
      metadata: { titulo, tipo, modalidad, validez, sha256Original },
    });

    const token = generarToken();
    const tokenHash = hashToken(token);
    const { error: tokenErr } = await admin.from("firmas_tokens").insert({
      documento_id: documentoId,
      token_hash: tokenHash,
      expira_en: expira.toISOString(),
    });
    if (tokenErr) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `No se pudo crear el token: ${tokenErr.message}` };
    }

    const empleadoNombre = `${emp.nombre} ${emp.apellidos ?? ""}`.trim();
    const sendResult = await enviarInvitacionFirma({
      to: destino,
      empresaId,
      empresaNombre,
      empresaLogoUrl,
      empleadoNombre,
      tituloDocumento: titulo,
      enviadoPor: enviadoPorNombre,
      token,
      expiraEn: expira,
      asuntoOverride: input.emailAsunto ?? null,
      introOverride: input.emailIntro ?? null,
    });

    await registrarEvento({
      documentoId,
      tipo: "enviado",
      actorUserId: enviadoPorUserId,
      ip,
      userAgent,
      metadata: {
        destino,
        emailTransport: sendResult.ok ? sendResult.transport : null,
        emailOk: sendResult.ok,
        emailError: !sendResult.ok && "error" in sendResult ? sendResult.error : null,
      },
    });

    return { ok: true, documentoId, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[firmas] crearFirmaInterno:", msg);
    return { ok: false, error: msg };
  }
}
