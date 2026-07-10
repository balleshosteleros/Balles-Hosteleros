"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { PDFDocument } from "pdf-lib";
import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { sha256, generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";
import { registrarEvento } from "@/features/rrhh/services/firmas/audit";
import { enviarInvitacionFirma } from "@/features/rrhh/services/firmas/email";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import {
  generarSancionPdf,
  SANCION_FIRMA_LAYOUT,
  type GravedadSancion,
} from "@/features/gerencia/services/sancion-disciplinaria-pdf";

const BUCKET = "firmas";
const TIPO_DOC = "sancion_disciplinaria";

async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") || null };
}

async function requireAdmin(): Promise<{ userId: string; userName: string; empresaId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { esDirector } = await getRolContext();
  if (!esDirector) throw new Error("Solo dirección puede emitir sanciones disciplinarias");

  const { empresaId } = await getAppContext();
  if (!empresaId) throw new Error("Empresa no resuelta para el usuario actual");

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.email as string | undefined) ||
    "Dirección";

  return { userId: user.id, userName: fullName, empresaId };
}

export interface SancionInput {
  empleadoId: string;
  gravedad: GravedadSancion;
  fechaHechos?: string | null;
  hechos: string;
  normaInfringida?: string | null;
  medida: string;
  fechaEmision: string;
  /** Días de plazo para firmar el acuse de recibo. */
  plazoDias?: number;
}

export type CrearSancionResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

/**
 * Emite una SANCIÓN DISCIPLINARIA: genera el PDF oficial, lo registra en el
 * pipeline de firmas (`firmas_documentos`, modalidad manuscrita) y avisa al
 * trabajador por email + notificación in-app para que lo firme como «leído».
 * Al firmar, el motor de firma archiva el PDF firmado en la carpeta de
 * documentos del empleado (categoría `sanciones`).
 */
export async function crearSancionDisciplinaria(
  input: SancionInput,
): Promise<CrearSancionResult> {
  try {
    const { userId, userName, empresaId } = await requireAdmin();
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const empleadoId = (input.empleadoId ?? "").trim();
    if (!empleadoId) return { ok: false, error: "Falta el trabajador destinatario" };
    if (!input.hechos?.trim()) return { ok: false, error: "Describe los hechos que motivan la sanción" };
    if (!input.medida?.trim()) return { ok: false, error: "Indica la medida disciplinaria adoptada" };
    if (!input.fechaEmision) return { ok: false, error: "Falta la fecha de emisión" };

    const plazoDias = Math.max(1, Math.min(60, Number(input.plazoDias ?? 15) || 15));

    const { data: emp, error: empErr } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, dni_nie, puesto, email_empresa, email_personal, empresa_id, estado, departamentos ( nombre )")
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr || !emp) return { ok: false, error: "Trabajador no encontrado" };
    if (emp.empresa_id !== empresaId) return { ok: false, error: "El trabajador no pertenece a tu empresa" };
    if (emp.estado !== "Activo") return { ok: false, error: "El trabajador no está activo" };

    const destino = (emp.email_empresa as string | null) || (emp.email_personal as string | null);
    if (!destino) return { ok: false, error: "El trabajador no tiene email; añádelo antes de enviar" };

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url, isotipo_url")
      .eq("id", empresaId)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "La empresa";
    const empresaLogoUrl =
      ((empresa?.isotipo_url as string | null) || (empresa?.logo_url as string | null)) ?? null;

    const empleadoNombre = `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim();
    const departamento =
      (emp as unknown as { departamentos?: { nombre?: string | null } | null }).departamentos?.nombre ?? null;

    // 1) Generar el PDF oficial de la sanción.
    const pdfBytes = await generarSancionPdf({
      empresaNombre,
      empleadoNombre: empleadoNombre || "Trabajador/a",
      empleadoDni: (emp.dni_nie as string | null) ?? null,
      puesto: (emp.puesto as string | null) ?? null,
      departamento,
      gravedad: input.gravedad,
      fechaHechos: input.fechaHechos ?? null,
      hechos: input.hechos.trim(),
      normaInfringida: input.normaInfringida?.trim() || null,
      medida: input.medida.trim(),
      fechaEmision: input.fechaEmision,
      emitidoPor: userName,
    });
    const pdfBuffer = Buffer.from(pdfBytes);
    const sha256Original = sha256(pdfBuffer);

    // Última página → banda de firma (posición por defecto para el motor).
    let ultimaPagina = 1;
    try {
      const doc = await PDFDocument.load(pdfBytes);
      ultimaPagina = doc.getPageCount();
    } catch {
      ultimaPagina = 1;
    }
    const posicionFirmaDefault = { pagina: ultimaPagina, ...SANCION_FIRMA_LAYOUT };

    const titulo = `Sanción disciplinaria — ${empleadoNombre || "Trabajador/a"}`;
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + plazoDias * 86_400_000);

    // 2) Registrar el documento firmable.
    const { data: docIns, error: docErr } = await admin
      .from("firmas_documentos")
      .insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        titulo,
        tipo: TIPO_DOC,
        modalidad: "manuscrita_digital",
        validez: "eidas_simple",
        estado: "pendiente",
        pdf_original_path: "pending",
        sha256_original: sha256Original,
        enviado_por: userId,
        enviado_en: ahora.toISOString(),
        expira_en: expira.toISOString(),
        posicion_firma_default: posicionFirmaDefault,
        observaciones: null,
      })
      .select("id")
      .single();
    if (docErr || !docIns) {
      return { ok: false, error: docErr?.message ?? "No se pudo registrar la sanción" };
    }
    const documentoId = docIns.id as string;
    const path = `${empresaId}/${documentoId}/original.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, pdfBuffer, { upsert: false, contentType: "application/pdf" });
    if (upErr) {
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `Subida a Storage falló: ${upErr.message}` };
    }
    await admin.from("firmas_documentos").update({ pdf_original_path: path }).eq("id", documentoId);

    await registrarEvento({
      documentoId,
      tipo: "creado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { titulo, tipo: TIPO_DOC, gravedad: input.gravedad, sha256Original },
    });

    // 3) Token de firma de un solo uso.
    const token = generarToken();
    const { error: tokenErr } = await admin.from("firmas_tokens").insert({
      documento_id: documentoId,
      token_hash: hashToken(token),
      expira_en: expira.toISOString(),
    });
    if (tokenErr) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `No se pudo crear el token: ${tokenErr.message}` };
    }

    // 4) Email de invitación (con tono de acuse de recibo) + notificación in-app.
    const sendResult = await enviarInvitacionFirma({
      to: destino,
      empresaId,
      empresaNombre,
      empresaLogoUrl,
      empleadoNombre: empleadoNombre || "Trabajador/a",
      tituloDocumento: titulo,
      enviadoPor: userName,
      token,
      expiraEn: expira,
      asuntoOverride: `Comunicación de sanción disciplinaria — ${empresaNombre}`,
      introOverride:
        `Hola ${empleadoNombre || ""},\n\n` +
        `La dirección de ${empresaNombre} te comunica una sanción disciplinaria. ` +
        `Debes firmar el documento como acuse de recibo (leído/informado). ` +
        `La firma NO implica conformidad: conservas tu derecho a impugnarla.`,
    });

    await registrarEvento({
      documentoId,
      tipo: "enviado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { destino, emailOk: sendResult.ok },
    });

    try {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
      await emitirNotificacion({
        empresaId,
        tipo: "warning",
        titulo: "Sanción disciplinaria — firma requerida",
        mensaje: "Has recibido una comunicación de sanción disciplinaria. Fírmala como acuse de recibo (leído).",
        segmento: { tipo: "empleados", empleadoIds: [empleadoId] },
        accionLabel: "Firmar",
        accionUrl: `${base}/firmar/${encodeURIComponent(token)}`,
        refTabla: "firmas_documentos",
        refId: documentoId,
        dedupeKey: `sancion-${documentoId}`,
        system: true,
      });
    } catch (e) {
      console.error("[sancion] notificar:", e);
    }

    revalidatePath("/gerencia/comunicados");
    return { ok: true, documentoId, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sancion] crearSancionDisciplinaria:", msg);
    return { ok: false, error: msg };
  }
}

export interface SancionResumen {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  estado: string;
  enviadoEn: string;
  expiraEn: string;
  firmadoEn: string | null;
}

/** Lista las sanciones disciplinarias emitidas por la empresa. */
export async function listSancionesDisciplinarias(): Promise<
  { ok: true; data: SancionResumen[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("firmas_documentos")
      .select(`
        id, estado, empleado_id, enviado_en, expira_en, firmado_en,
        empleados!firmas_documentos_empleado_id_fkey ( nombre, apellidos, departamentos ( nombre ) )
      `)
      .eq("empresa_id", empresaId)
      .eq("tipo", TIPO_DOC)
      .order("enviado_en", { ascending: false });
    if (error) throw error;

    type Row = {
      id: string;
      estado: string;
      empleado_id: string;
      enviado_en: string;
      expira_en: string;
      firmado_en: string | null;
      empleados: { nombre: string | null; apellidos: string | null; departamentos: { nombre: string | null } | null } | null;
    };
    const items: SancionResumen[] = (data as unknown as Row[]).map((r) => ({
      id: r.id,
      empleadoId: r.empleado_id,
      empleadoNombre: `${r.empleados?.nombre ?? ""} ${r.empleados?.apellidos ?? ""}`.trim() || "—",
      departamento: r.empleados?.departamentos?.nombre ?? "—",
      estado: r.estado,
      enviadoEn: r.enviado_en,
      expiraEn: r.expira_en,
      firmadoEn: r.firmado_en,
    }));
    return { ok: true, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error listando sanciones";
    console.error("[sancion] listSancionesDisciplinarias:", msg);
    return { ok: false, error: msg };
  }
}
