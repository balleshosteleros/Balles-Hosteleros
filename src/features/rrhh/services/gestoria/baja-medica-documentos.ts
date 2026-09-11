import "server-only";

/**
 * COMPROBANTE de la baja médica, que sube la GESTORÍA.
 *
 * Hasta ahora el circuito solo iba de ida: se comunicaba la baja y ahí acababa
 * todo, el comprobante se quedaba en el despacho de la gestoría y la empresa no
 * tenía la prueba de haberla comunicado. Este enlace es la vuelta.
 *
 * Mismo patrón que el contrato del alta y los papeles de la baja de contrato:
 * del token solo se guarda el hash, el enlace caduca y la gestoría no necesita
 * usuario ni contraseña.
 *
 * Al recibirse, el documento (a) se archiva en la carpeta «Bajas médicas» del
 * trabajador y (b) queda apuntado en el historial de la solicitud.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";
import { getSiteUrl } from "@/lib/site-url";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";
import {
  registrarComunicacion,
  DESTINATARIO_GESTORIA,
} from "@/features/comunicaciones/services/registro";

const BUCKET_STAGING = "bajas-medicas";
const BUCKET_EMPLEADO = "empleados-docs";
export const CATEGORIA_BAJAS_MEDICAS = "bajas-medicas";

/** Los dos documentos de una baja médica, con el título con el que se archivan. */
export const TITULO_PARTE = "Parte de baja";
export const TITULO_COMPROBANTE = "Comprobante de la baja";

export interface BajaMedicaTokenRow {
  id: string;
  empresa_id: string;
  solicitud_id: string;
  empleado_id: string;
  fecha_inicio: string;
  comprobante_subido_en: string | null;
}

/** dd/mm/aaaa desde un ISO de calendario, en UTC puro (sin saltos de huso). */
export function fechaEs(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/**
 * Nombre con el que se archiva cada documento de la baja.
 *
 * Lleva el PRIMER DÍA de la baja, no el nombre del fichero que suba cada uno:
 * el trabajador manda fotos del móvil (`IMG_2831.jpg`) y la gestoría ficheros con
 * el número de expediente. Con la fecha, los dos quedan juntos en la carpeta y
 * se ve de un vistazo a qué baja le falta el comprobante.
 */
export function nombreDocBaja(titulo: string, fechaInicioIso: string): string {
  return `${titulo} ${fechaEs(fechaInicioIso)}.pdf`;
}

/** Enlace público donde la gestoría sube el comprobante. */
export function urlSubidaComprobante(token: string): string {
  return `${getSiteUrl()}/gestoria/baja-medica/${encodeURIComponent(token)}`;
}

/**
 * Enlace del RECORDATORIO. El token en claro solo existe dentro del primer
 * correo, así que el recordatorio enlaza por el HASH y la pantalla lo resuelve
 * por esa vía. Mismo mecanismo que el contrato del alta.
 */
export function urlRecordatorioComprobante(tokenHash: string): string {
  return `${getSiteUrl()}/gestoria/baja-medica/r/${encodeURIComponent(tokenHash)}`;
}

/** Botón «Adjuntar el comprobante de la baja» para el correo a la gestoría. */
export function botonComprobanteHtml(token: string): string {
  return botonComprobanteUrlHtml(urlSubidaComprobante(token));
}

/** El mismo botón, a partir de la URL ya resuelta (token o hash). */
export function botonComprobanteUrlHtml(url: string): string {
  return `
    <div style="margin:22px 0;padding:18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;text-align:center">
      <a href="${url}"
         style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
        Adjuntar el comprobante de la baja
      </a>
      <p style="color:#4d7c5a;font-size:12px;margin:12px 0 0 0;line-height:1.55">
        Al pulsar veréis el nombre y el DNI del trabajador antes de subir nada, para no
        confundir de persona. El enlace es único para esta baja.
      </p>
    </div>`;
}

/**
 * Crea (o reemplaza) el enlace de subida de una baja médica. Caduca 60 días
 * después del primer día de la baja, y nunca antes de 60 días desde hoy: una
 * baja larga no puede quedarse sin enlace a mitad.
 */
export async function crearTokenComprobante(
  admin: SupabaseClient,
  params: {
    empresaId: string;
    solicitudId: string;
    empleadoId: string;
    fechaInicioIso: string;
  },
): Promise<{ ok: true; token: string; tokenId: string } | { ok: false; error: string }> {
  try {
    const token = generarToken();
    const tokenHash = hashToken(token);

    const inicio = new Date(`${params.fechaInicioIso}T00:00:00Z`).getTime();
    const base = Number.isNaN(inicio) ? Date.now() : Math.max(inicio, Date.now());
    const expira = new Date(base + 60 * 86_400_000).toISOString();

    // Una baja tiene un único enlace vivo: reenviar el aviso reemplaza el
    // anterior, para que no circulen dos enlaces distintos de lo mismo.
    await admin.from("baja_medica_doc_tokens").delete().eq("solicitud_id", params.solicitudId);

    const { data, error } = await admin
      .from("baja_medica_doc_tokens")
      .insert({
        empresa_id: params.empresaId,
        solicitud_id: params.solicitudId,
        empleado_id: params.empleadoId,
        token_hash: tokenHash,
        fecha_inicio: params.fechaInicioIso,
        expira_en: expira,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "No se pudo crear el enlace" };
    }
    return { ok: true, token, tokenId: data.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error creando el enlace",
    };
  }
}

/** Resuelve un token en claro. */
export async function resolverTokenComprobante(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; row: BajaMedicaTokenRow }
  | { ok: false; reason: "not_found" | "expired" }
> {
  const { data } = await admin
    .from("baja_medica_doc_tokens")
    .select("id, empresa_id, solicitud_id, empleado_id, fecha_inicio, expira_en, comprobante_subido_en")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      solicitud_id: data.solicitud_id as string,
      empleado_id: data.empleado_id as string,
      fecha_inicio: data.fecha_inicio as string,
      comprobante_subido_en: (data.comprobante_subido_en as string | null) ?? null,
    },
  };
}

/** Resuelve el token por su HASH (el enlace del recordatorio). */
export async function resolverTokenComprobantePorHash(
  admin: SupabaseClient,
  tokenHash: string,
): Promise<
  | { ok: true; row: BajaMedicaTokenRow }
  | { ok: false; reason: "not_found" | "expired" }
> {
  const { data } = await admin
    .from("baja_medica_doc_tokens")
    .select("id, empresa_id, solicitud_id, empleado_id, fecha_inicio, expira_en, comprobante_subido_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      solicitud_id: data.solicitud_id as string,
      empleado_id: data.empleado_id as string,
      fecha_inicio: data.fecha_inicio as string,
      comprobante_subido_en: (data.comprobante_subido_en as string | null) ?? null,
    },
  };
}

/**
 * Archiva un documento de la baja en la carpeta «Bajas médicas» del trabajador.
 *
 * Lo usan los dos lados: el parte que sube el trabajador y el comprobante que
 * devuelve la gestoría. Best-effort: si la carpeta falla, el documento ya está a
 * salvo donde se subió y el circuito no se detiene.
 */
export async function archivarEnCarpetaBajas(
  admin: SupabaseClient,
  args: {
    empresaId: string;
    empleadoId: string;
    solicitudId: string;
    fechaInicioIso: string;
    titulo: string;
    buffer: Buffer;
  },
): Promise<void> {
  try {
    const destPath = `${args.empresaId}/${args.empleadoId}/baja-medica-${args.solicitudId}-${
      args.titulo === TITULO_COMPROBANTE ? "comprobante" : "parte"
    }.pdf`;
    const copia = await admin.storage
      .from(BUCKET_EMPLEADO)
      .upload(destPath, args.buffer, { upsert: true, contentType: "application/pdf" });
    if (copia.error) {
      console.error("[baja-medica] archivar en carpeta:", copia.error.message);
      return;
    }
    // upsert manual: si se resube, se reemplaza la fila en vez de duplicarla.
    await admin
      .from("documentos_empleado")
      .delete()
      .eq("empresa_id", args.empresaId)
      .eq("empleado_id", args.empleadoId)
      .eq("storage_path", destPath);
    await admin.from("documentos_empleado").insert({
      empresa_id: args.empresaId,
      empleado_id: args.empleadoId,
      categoria: CATEGORIA_BAJAS_MEDICAS,
      nombre: nombreDocBaja(args.titulo, args.fechaInicioIso),
      storage_path: destPath,
      tipo_mime: "application/pdf",
      tamano_bytes: args.buffer.length,
    });
  } catch (e) {
    console.error("[baja-medica] archivar en carpeta:", e);
  }
}

/** Recibe el comprobante de la gestoría: valida, guarda, archiva y apunta. */
export async function procesarSubidaComprobante(
  admin: SupabaseClient,
  row: BajaMedicaTokenRow,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (file.type !== "application/pdf") {
    return { ok: false, error: "El comprobante debe ser un PDF", status: 400 };
  }
  if (file.size === 0) return { ok: false, error: "Adjunta el comprobante (PDF)", status: 400 };
  if (file.size > MAX_DOCUMENTO_BYTES) {
    return { ok: false, error: `El PDF supera ${MAX_DOCUMENTO_MB} MB`, status: 400 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const stagingPath = `${row.empresa_id}/comprobantes/${row.solicitud_id}.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET_STAGING)
    .upload(stagingPath, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    return { ok: false, error: `No se pudo guardar el comprobante: ${upErr.message}`, status: 500 };
  }

  await archivarEnCarpetaBajas(admin, {
    empresaId: row.empresa_id,
    empleadoId: row.empleado_id,
    solicitudId: row.solicitud_id,
    fechaInicioIso: row.fecha_inicio,
    titulo: TITULO_COMPROBANTE,
    buffer,
  });

  await admin
    .from("baja_medica_doc_tokens")
    .update({
      comprobante_path: stagingPath,
      comprobante_subido_en: new Date().toISOString(),
    })
    .eq("id", row.id);

  // Queda en el historial de la solicitud: es la prueba de que la baja se
  // comunicó, y RRHH lo ve sin salir de la pantalla de solicitudes.
  await registrarComunicacion({
    empresaId: row.empresa_id,
    refTabla: "solicitudes_personal",
    refId: row.solicitud_id,
    via: "notificacion",
    asunto: `${TITULO_COMPROBANTE} recibido`,
    destinatario: DESTINATARIO_GESTORIA,
    automatico: true,
    enviadoPorNombre: "La gestoría",
  });

  await avisarRrhhComprobanteRecibido(admin, row);

  return { ok: true };
}

/** Aviso interno a RRHH: ya está el comprobante, la baja está cerrada. */
async function avisarRrhhComprobanteRecibido(
  admin: SupabaseClient,
  row: BajaMedicaTokenRow,
): Promise<void> {
  try {
    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos")
      .eq("id", row.empleado_id)
      .maybeSingle();
    const nombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "un trabajador";

    const { emitirNotificacion } = await import(
      "@/features/notificaciones/actions/notificaciones-actions"
    );
    await emitirNotificacion({
      system: true,
      empresaId: row.empresa_id,
      segmento: { tipo: "rol", rolLabel: "RECURSOS HUMANOS" },
      tipo: "info",
      titulo: "Comprobante de baja médica recibido",
      mensaje:
        `La gestoría ha subido el comprobante de la baja médica de ${nombre} ` +
        `(${fechaEs(row.fecha_inicio)}). Ya está en su carpeta de documentos.`,
      refTabla: "solicitudes_personal",
      refId: row.solicitud_id,
      dedupeKey: `baja_medica_comprobante:${row.solicitud_id}`,
    });
  } catch (e) {
    console.error("[baja-medica] aviso a RRHH:", e);
  }
}

/**
 * Recordatorio a la gestoría de los comprobantes que siguen sin subir.
 *
 * Cada cuántos días lo decide la empresa en Ajustes → Solicitudes (0 = no
 * recordar). Se repite mientras el comprobante no llegue: no es un único aviso
 * que se pierde si cae en un día malo.
 *
 * Vive aquí y no en su propio cron a propósito: Vercel limita los crons diarios
 * del plan y añadir uno más bloquearía todos los despliegues. Lo invoca el cron
 * de gestoría que ya existe.
 */
export async function procesarRecordatoriosComprobante(
  admin: SupabaseClient,
): Promise<{ enviados: number }> {
  const { data: cfgs } = await admin
    .from("empresa_rrhh_config")
    .select("empresa_id, baja_medica_recordatorio_dias");

  // 0 = apagado para esa empresa. Sin fila, el default del negocio: 3 días.
  const diasPorEmpresa = new Map<string, number>();
  for (const c of cfgs ?? []) {
    const d = Number((c as { baja_medica_recordatorio_dias: unknown }).baja_medica_recordatorio_dias ?? 3);
    diasPorEmpresa.set((c as { empresa_id: string }).empresa_id, Number.isFinite(d) ? d : 3);
  }

  const { data: pendientes } = await admin
    .from("baja_medica_doc_tokens")
    .select("id, empresa_id, solicitud_id, empleado_id, token_hash, fecha_inicio, expira_en, created_at, recordatorio_ultimo_en")
    .is("comprobante_subido_en", null);

  const ahora = Date.now();
  let enviados = 0;

  for (const tk of pendientes ?? []) {
    const empresaId = tk.empresa_id as string;
    const dias = diasPorEmpresa.get(empresaId) ?? 3;
    if (dias <= 0) continue;

    // Un enlace caducado no se recuerda: el correo llevaría a una puerta cerrada.
    if (new Date(tk.expira_en as string).getTime() < ahora) continue;

    // Se cuenta desde el último recordatorio si ya hubo; si no, desde el aviso.
    const desde = (tk.recordatorio_ultimo_en as string | null) ?? (tk.created_at as string);
    const transcurridos = (ahora - new Date(desde).getTime()) / 86_400_000;
    if (transcurridos < dias) continue;

    const [{ data: emp }, { data: empresa }] = await Promise.all([
      admin.from("empleados").select("nombre, apellidos").eq("id", tk.empleado_id as string).maybeSingle(),
      admin.from("empresas").select("nombre").eq("id", empresaId).maybeSingle(),
    ]);
    const nombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "un trabajador";
    const empresaNombre = (empresa?.nombre as string | undefined) ?? "la empresa";
    const fechaBaja = fechaEs(tk.fecha_inicio as string);

    const { resolverDestinatario } = await import(
      "@/features/rrhh/services/email-plantillas/resolver"
    );
    const dst = await resolverDestinatario(admin, empresaId, "departamento", "correoGestoria", null);
    if (!dst.to) continue;

    const subject = `${empresaNombre} · Recordatorio: comprobante de la baja médica de ${nombre}`;
    const html = `
      <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a;">Sigue pendiente el comprobante</h1>
      <p style="margin:0 0 14px 0;font-size:14px;line-height:1.62;color:#334155;">
        Os recordamos que la baja médica de <strong>${escapeHtmlSimple(nombre)}</strong>,
        con fecha de inicio <strong>${fechaBaja}</strong>, sigue sin su comprobante de tramitación.
      </p>
      ${botonComprobanteUrlHtml(urlRecordatorioComprobante(tk.token_hash as string))}
      <p style="margin:0;font-size:12.5px;color:#94a3b8;line-height:1.6;">
        Es el mismo enlace del correo anterior. Si ya lo habéis tramitado y solo falta subirlo, son dos clics.
      </p>`;
    const text =
      `Sigue pendiente el comprobante de la baja médica de ${nombre} (desde el ${fechaBaja}).\n\n` +
      `Subirlo aquí: ${urlRecordatorioComprobante(tk.token_hash as string)}`;

    const { sendEmail } = await import("@/lib/email/send");
    const res = await sendEmail({ to: dst.to, subject, html, text, empresaId });

    await registrarComunicacion({
      empresaId,
      refTabla: "solicitudes_personal",
      refId: tk.solicitud_id as string,
      via: "email",
      asunto: subject,
      destinatario: DESTINATARIO_GESTORIA,
      destinoEmail: dst.to,
      estado: res.ok ? "enviado" : "fallido",
      error: res.ok ? null : "No se pudo enviar el recordatorio",
      automatico: true,
    });

    if (res.ok) {
      // Se marca aunque el siguiente recordatorio dependa de esta misma fecha:
      // así se espacian en vez de salir todos los días.
      await admin
        .from("baja_medica_doc_tokens")
        .update({ recordatorio_ultimo_en: new Date().toISOString() })
        .eq("id", tk.id as string);
      enviados++;
    }
  }

  return { enviados };
}

/** Escape mínimo para el nombre dentro del HTML del recordatorio. */
function escapeHtmlSimple(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
