import "server-only";

/**
 * Servicios compartidos del flujo «alta a gestoría → subida de contrato → firma».
 *
 * Lo usan: la action de alta (genera el token y lo mete en el correo), la API
 * pública de subida (resuelve el token) y el cron de recordatorio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken, compararToken } from "@/features/rrhh/services/firmas/crypto";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { crearFirmaInterno } from "@/features/rrhh/services/firmas/crear-firma";
import { getReclutamientoConfigPorEmpresa } from "@/features/rrhh/actions/gestoria-config-server";
import { resolverPlantillaOnboarding, PLANTILLAS_ONBOARDING } from "@/features/rrhh/services/email-plantillas/resolver";

const BUCKET_STAGING = "contratos-gestoria";
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** URL base pública del software (mismo orden de prioridad que contratacion-actions). */
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Enlace público que abre la gestoría para subir el contrato firmado. */
export function urlSubidaContrato(token: string): string {
  return `${getSiteUrl()}/gestoria/contrato/${encodeURIComponent(token)}`;
}

/**
 * Enlace de RECORDATORIO. El token en claro no se persiste, así que el correo de
 * recordatorio (que sale del cron) enlaza por el hash del token. La pantalla
 * `/gestoria/contrato/r/<hash>` lo resuelve por hash y reusa el mismo flujo.
 */
export function urlRecordatorioContrato(tokenHash: string): string {
  return `${getSiteUrl()}/gestoria/contrato/r/${encodeURIComponent(tokenHash)}`;
}

/** Botón HTML «Adjuntar contrato firmado» para el correo de recordatorio (por hash). */
export function botonRecordatorioContratoHtml(tokenHash: string): string {
  const url = urlRecordatorioContrato(tokenHash);
  return `
    <div style="margin:20px 0">
      <a href="${url}"
         style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">
        Adjuntar contrato firmado
      </a>
      <p style="color:#888;font-size:12px;margin-top:8px">
        Es el mismo enlace del correo anterior. Al pulsar verás el nombre y el DNI/NIE del
        trabajador antes de subir el documento.
      </p>
    </div>`;
}

/** Resuelve un token de subida por su HASH (para el enlace de recordatorio). */
export async function resolverTokenContratoPorHash(
  admin: SupabaseClient,
  tokenHash: string,
): Promise<
  | { ok: true; row: { id: string; empresa_id: string; empleado_id: string } }
  | { ok: false; reason: "not_found" | "consumed" | "expired" }
> {
  const { data } = await admin
    .from("gestoria_contrato_tokens")
    .select("id, empresa_id, empleado_id, expira_en, contrato_subido_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (data.contrato_subido_en) return { ok: false, reason: "consumed" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: { id: data.id as string, empresa_id: data.empresa_id as string, empleado_id: data.empleado_id as string },
  };
}

/** Botón HTML «Adjuntar contrato firmado» para el correo a la gestoría. */
export function botonSubidaContratoHtml(token: string): string {
  const url = urlSubidaContrato(token);
  return `
    <div style="margin:20px 0">
      <a href="${url}"
         style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">
        Adjuntar contrato firmado
      </a>
      <p style="color:#888;font-size:12px;margin-top:8px">
        Al pulsar verás el nombre y el DNI/NIE del trabajador antes de subir el documento,
        para evitar confusiones. El enlace es único para este trabajador.
      </p>
    </div>`;
}

/**
 * Crea (o reemplaza) el token de subida de contrato para un empleado y devuelve
 * el token en claro (para incrustarlo en el correo). Se ejecuta con service role
 * desde la action de alta. Caduca a `plazoDias`.
 */
export async function crearTokenContratoGestoria(
  admin: SupabaseClient,
  params: { empresaId: string; empleadoId: string; plazoDias?: number },
): Promise<{ ok: true; token: string; tokenId: string } | { ok: false; error: string }> {
  try {
    // Máximo 7 días: el enlace de subida de contrato caduca pronto por seguridad.
    const plazoDias = Math.max(1, Math.min(7, params.plazoDias ?? 7));
    const token = generarToken();
    const tokenHash = hashToken(token);
    const expira = new Date(Date.now() + plazoDias * 86_400_000).toISOString();

    const { data, error } = await admin
      .from("gestoria_contrato_tokens")
      .insert({
        empresa_id: params.empresaId,
        empleado_id: params.empleadoId,
        token_hash: tokenHash,
        expira_en: expira,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el token" };
    return { ok: true, token, tokenId: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando token de gestoría";
    return { ok: false, error: msg };
  }
}

/** Resuelve un token de subida de contrato (single-use por `contrato_subido_en`). */
export async function resolverTokenContratoGestoria(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; row: { id: string; empresa_id: string; empleado_id: string; contrato_subido_en: string | null } }
  | { ok: false; reason: "not_found" | "consumed" | "expired" }
> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("gestoria_contrato_tokens")
    .select("id, empresa_id, empleado_id, token_hash, expira_en, contrato_subido_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  if (data.contrato_subido_en) return { ok: false, reason: "consumed" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      empleado_id: data.empleado_id as string,
      contrato_subido_en: data.contrato_subido_en as string | null,
    },
  };
}

export interface ContratoTokenRow {
  id: string;
  empresa_id: string;
  empleado_id: string;
}

/**
 * Núcleo de la subida del contrato por la gestoría (compartido por las rutas
 * por-token y por-hash): valida el PDF, lo guarda en staging, crea la solicitud
 * de FIRMA para el trabajador (el módulo Firmas le envía el enlace), marca el
 * token como consumido y avisa a RRHH (tick 3).
 */
export async function procesarSubidaContrato(
  admin: SupabaseClient,
  row: ContratoTokenRow,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (file.type !== "application/pdf") return { ok: false, error: "El contrato debe ser un PDF", status: 400 };
  if (file.size === 0) return { ok: false, error: "Adjunta el contrato (PDF)", status: 400 };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: "El PDF supera 10 MB", status: 400 };

  const { data: emp } = await admin
    .from("empleados")
    .select("nombre, apellidos")
    .eq("id", row.empleado_id)
    .maybeSingle();
  const empleadoNombre =
    `${(emp?.nombre as string) ?? ""} ${(emp?.apellidos as string) ?? ""}`.trim() || "Trabajador";

  const buffer = Buffer.from(await file.arrayBuffer());

  // 1) Staging del PDF original tal cual lo subió la gestoría.
  const stagingPath = `${row.empresa_id}/${row.empleado_id}/contrato-gestoria.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET_STAGING)
    .upload(stagingPath, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) return { ok: false, error: `No se pudo guardar el contrato: ${upErr.message}`, status: 500 };

  // 2) Solicitud de FIRMA para el trabajador (Firmas envía el email al empleado).
  // PRP-070: asunto + intro del correo desde la plantilla editable «Contrato
  // oficial (a firmar)». El diseño y el botón de firma se mantienen.
  const enviadoPor = await resolverEnviadoPor(admin, row.empresa_id);
  const { data: empresaRow } = await admin
    .from("empresas").select("nombre").eq("id", row.empresa_id).maybeSingle();
  const tplOficial = await resolverPlantillaOnboarding(
    admin, row.empresa_id, PLANTILLAS_ONBOARDING.contratoOficial,
    { candidato_nombre: (emp?.nombre as string) ?? "", empresa_nombre: (empresaRow?.nombre as string) ?? "" },
  );

  // Documento EXTERNO (lo genera la gestoría, no el sistema): no sabemos dónde
  // va la firma y los contratos escaneados no permiten detectar texto de forma
  // fiable. En vez de fijar una posición "a ojo" (antes yPct:0.85, que caía
  // donde caía), NO pasamos posicionFirmaDefault: el empleado coloca su firma
  // arrastrándola sobre el punto correcto del contrato al firmar.
  const firma = await crearFirmaInterno({
    empresaId: row.empresa_id,
    empleadoId: row.empleado_id,
    pdf: buffer,
    titulo: "Contrato de trabajo",
    tipo: "contrato",
    modalidad: "manuscrita_digital",
    validez: "eidas_avanzada",
    plazoDias: 14,
    observaciones: "Contrato subido por la gestoría tras el alta.",
    enviadoPorUserId: enviadoPor,
    enviadoPorNombre: "RRHH",
    emailAsunto: tplOficial?.asunto ?? null,
    emailIntro: tplOficial?.cuerpo ?? null,
    // Sin posición por defecto: el trabajador la coloca a mano (doc externo).
    posicionFirmaDefault: null,
  });

  // 3) Marca el token consumido + traza (incluso si la firma falló, el PDF está).
  await admin
    .from("gestoria_contrato_tokens")
    .update({
      contrato_subido_en: new Date().toISOString(),
      contrato_path: stagingPath,
      firma_documento_id: firma.ok ? firma.documentoId : null,
    })
    .eq("id", row.id);

  if (!firma.ok) {
    console.error("[gestoria/contrato] crearFirma falló:", firma.error);
    return {
      ok: false,
      error: "El contrato se recibió, pero no se pudo enviar a firma. Avisa a la empresa.",
      status: 500,
    };
  }

  // Tick 3.
  const cfg = await getReclutamientoConfigPorEmpresa(admin, row.empresa_id);
  if (cfg.notif_contrato_subido) {
    await notificarRrhhGestoria({
      empresaId: row.empresa_id,
      tipo: "gestoria_contrato_subido",
      titulo: `Contrato recibido de la gestoría: ${empleadoNombre}`,
      mensaje: `La gestoría subió el contrato de ${empleadoNombre}. Se ha enviado al trabajador para su firma.`,
      empleadoId: row.empleado_id,
      dedupeKey: `gestoria_subido:${row.id}`,
    });
  }

  return { ok: true };
}

/** `enviado_por` para la firma: primer empleado con login de la empresa. */
async function resolverEnviadoPor(admin: SupabaseClient, empresaId: string): Promise<string> {
  const { data } = await admin
    .from("empleados")
    .select("user_id")
    .eq("empresa_id", empresaId)
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string) ?? "00000000-0000-0000-0000-000000000000";
}

/**
 * Aviso in-app al departamento de RRHH (área administrativa) por cada hito del
 * flujo de gestoría. Best-effort: nunca rompe el flujo de negocio. Cada tipo
 * se controla con su toggle en `reclutamiento_config`.
 */
export async function notificarRrhhGestoria(params: {
  empresaId: string;
  tipo:
    | "gestoria_alta_enviada"
    | "gestoria_recordatorio"
    | "gestoria_contrato_subido"
    | "gestoria_contrato_firmado"
    // PRP-070 — hitos del flujo de Contratación
    | "contratacion_iniciada"
    | "contrato_interno_enviado"
    | "contrato_interno_firmado"
    | "reconocimiento_medico_enviado"
    | "reconocimiento_medico_firmado"
    | "alta_completada";
  titulo: string;
  mensaje: string;
  empleadoId: string;
  dedupeKey?: string;
}): Promise<void> {
  try {
    await emitirNotificacion({
      empresaId: params.empresaId,
      system: true,
      tipo: params.tipo,
      titulo: params.titulo,
      mensaje: params.mensaje,
      segmento: { tipo: "area", area: "ADMINISTRATIVA" },
      refTabla: "empleados",
      refId: params.empleadoId,
      accionUrl: "/rrhh/reclutamiento",
      dedupeKey: params.dedupeKey,
    });
  } catch (e) {
    console.error("[gestoria] notificarRrhhGestoria:", e);
  }
}
