import "server-only";

/**
 * Documentos OFICIALES de la baja, subidos por la GESTORÍA.
 *
 * Se le piden DOS:
 *   1) JUSTIFICANTE DE BAJA (sistema RED / TA.2-S) — OBLIGATORIO. Acredita la
 *      baja ante la Seguridad Social: lleva la FECHA de efecto y el CÓDIGO DE LA
 *      CAUSA (voluntaria, despido, fin de contrato…). Es la prueba que la empresa
 *      debe archivar.
 *   2) CERTIFICADO DE EMPRESA (SEPE) — OPCIONAL. Permite al trabajador solicitar
 *      la prestación por desempleo.
 *
 * Ninguno lo firma el trabajador: son actos entre la empresa y la Administración.
 * El único documento firmable de la salida es el finiquito, que llega por el
 * circuito de NÓMINAS, no por aquí.
 *
 * Al recibirse, cada documento (a) se archiva en la carpeta del trabajador y
 * (b) se le envía por EMAIL: el último día ya suele estar inactivo y sin acceso
 * al sistema, así que el correo es su única vía para conservarlos.
 *
 * Mismo patrón que la subida del contrato en el alta: token hash-only, enlace
 * público y recordatorio automático.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken, compararToken } from "@/features/rrhh/services/firmas/crypto";
import { getSiteUrl } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/send";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";

const BUCKET_STAGING = "bajas-gestoria";
const BUCKET_EMPLEADO = "empleados-docs";

/** Los dos documentos que se piden. `justificante` es el que bloquea. */
export type ClaveDocBaja = "justificante" | "certificado";

export const DOCS_BAJA: Array<{
  clave: ClaveDocBaja;
  label: string;
  descripcion: string;
  obligatorio: boolean;
}> = [
  {
    clave: "justificante",
    label: "Justificante de baja (Seguridad Social)",
    descripcion:
      "Resolución del sistema RED con la fecha de la baja y el código de la causa (TA.2/S).",
    obligatorio: true,
  },
  {
    clave: "certificado",
    label: "Certificado de empresa (SEPE)",
    descripcion: "El que permite al trabajador solicitar la prestación por desempleo.",
    obligatorio: false,
  },
];

/** Enlace público donde la gestoría adjunta los documentos de la baja. */
export function urlSubidaDocsBaja(token: string): string {
  return `${getSiteUrl()}/gestoria/baja/${encodeURIComponent(token)}`;
}

/**
 * Enlace de RECORDATORIO. El token en claro no se persiste (solo su hash), así
 * que el correo del cron enlaza POR HASH y la pantalla lo resuelve por esa vía.
 * Mismo mecanismo que el recordatorio de contrato del alta.
 */
export function urlRecordatorioDocsBaja(tokenHash: string): string {
  return `${getSiteUrl()}/gestoria/baja/r/${encodeURIComponent(tokenHash)}`;
}

/** Resuelve el token de subida por su HASH (enlace de recordatorio). */
export async function resolverTokenDocsBajaPorHash(
  admin: SupabaseClient,
  tokenHash: string,
): Promise<{ ok: true; row: DocsBajaRow } | { ok: false; reason: "not_found" | "expired" }> {
  const { data } = await admin
    .from("gestoria_baja_doc_tokens")
    .select("id, empresa_id, empleado_id, expira_en, justificante_subido_en, certificado_subido_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      empleado_id: data.empleado_id as string,
      justificante_subido_en: data.justificante_subido_en as string | null,
      certificado_subido_en: data.certificado_subido_en as string | null,
    },
  };
}

/**
 * Botón HTML «Adjuntar documentos de la baja».
 *
 * `url` se pasa ya resuelta porque hay DOS enlaces posibles: el del correo
 * inicial (por token en claro) y el del recordatorio (por hash, ya que el token
 * en claro no se persiste). Ver `urlSubidaDocsBaja` / `urlRecordatorioDocsBaja`.
 */
export function botonDocsBajaHtml(url: string, opts?: { recordatorio?: boolean }): string {
  const color = opts?.recordatorio ? "#dc2626" : "#16a34a";
  return `
    <div style="margin:20px 0">
      <a href="${url}"
         style="display:inline-block;background:${color};color:#fff;text-decoration:none;
                padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">
        Adjuntar documentos de la baja
      </a>
      <p style="color:#888;font-size:12px;margin-top:8px">
        Al pulsar verás el nombre y el DNI/NIE del trabajador antes de subir nada.
        Se piden el <b>justificante de baja de la Seguridad Social</b> (obligatorio) y el
        <b>certificado de empresa</b> para el SEPE. El enlace es único para este trabajador.
      </p>
    </div>`;
}

/**
 * Crea el token de subida de documentos de la baja. Se llama al avisar a la
 * gestoría. El plazo va ligado a la fecha de baja: se deja margen suficiente
 * después del último día (los documentos del RED se emiten al tramitar la baja,
 * que puede ser posterior a la comunicación).
 */
export async function crearTokenDocsBaja(
  admin: SupabaseClient,
  params: { empresaId: string; empleadoId: string; bajaId?: string | null; ultimoDiaIso: string },
): Promise<{ ok: true; token: string; tokenId: string } | { ok: false; error: string }> {
  try {
    const token = generarToken();
    const tokenHash = hashToken(token);

    // Caduca 30 días DESPUÉS del último día de trabajo (nunca antes de 30 días
    // desde hoy: si la baja se comunica tarde, el enlace debe seguir sirviendo).
    const finBaja = new Date(`${params.ultimoDiaIso}T00:00:00Z`).getTime();
    const base = Number.isNaN(finBaja) ? Date.now() : Math.max(finBaja, Date.now());
    const expira = new Date(base + 30 * 86_400_000).toISOString();

    const { data, error } = await admin
      .from("gestoria_baja_doc_tokens")
      .insert({
        empresa_id: params.empresaId,
        empleado_id: params.empleadoId,
        baja_id: params.bajaId ?? null,
        token_hash: tokenHash,
        expira_en: expira,
        ultimo_dia: params.ultimoDiaIso,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el enlace" };
    return { ok: true, token, tokenId: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando el enlace de documentos de baja";
    return { ok: false, error: msg };
  }
}

export interface DocsBajaRow {
  id: string;
  empresa_id: string;
  empleado_id: string;
  justificante_subido_en: string | null;
  certificado_subido_en: string | null;
}

/** Resuelve el token de subida. Sigue válido aunque ya se subiera algo: la
 *  gestoría puede volver para adjuntar el segundo documento. */
export async function resolverTokenDocsBaja(
  admin: SupabaseClient,
  token: string,
): Promise<{ ok: true; row: DocsBajaRow } | { ok: false; reason: "not_found" | "expired" }> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("gestoria_baja_doc_tokens")
    .select("id, empresa_id, empleado_id, token_hash, expira_en, justificante_subido_en, certificado_subido_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      empleado_id: data.empleado_id as string,
      justificante_subido_en: data.justificante_subido_en as string | null,
      certificado_subido_en: data.certificado_subido_en as string | null,
    },
  };
}

/**
 * Núcleo de la subida: valida el PDF, lo guarda en staging, archiva una copia en
 * la carpeta del trabajador y se lo envía por email.
 */
export async function procesarSubidaDocBaja(
  admin: SupabaseClient,
  row: DocsBajaRow,
  clave: ClaveDocBaja,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const meta = DOCS_BAJA.find((d) => d.clave === clave);
  if (!meta) return { ok: false, error: "Documento no reconocido", status: 400 };
  if (file.type !== "application/pdf") return { ok: false, error: "El documento debe ser un PDF", status: 400 };
  if (file.size === 0) return { ok: false, error: "Adjunta el documento (PDF)", status: 400 };
  if (file.size > MAX_DOCUMENTO_BYTES) {
    return { ok: false, error: `El PDF supera ${MAX_DOCUMENTO_MB} MB`, status: 400 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 1) Staging: el PDF tal cual lo subió la gestoría.
  const stagingPath = `${row.empresa_id}/${row.empleado_id}/${clave}.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET_STAGING)
    .upload(stagingPath, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) return { ok: false, error: `No se pudo guardar el documento: ${upErr.message}`, status: 500 };

  // 2) Copia en la carpeta del trabajador (categoría `contratos`: documentación
  //    contractual). Best-effort: el documento ya está a salvo en staging.
  const nombreDoc = `${meta.label}.pdf`;
  try {
    const destPath = `${row.empresa_id}/${row.empleado_id}/baja-${clave}.pdf`;
    const copia = await admin.storage
      .from(BUCKET_EMPLEADO)
      .upload(destPath, buffer, { upsert: true, contentType: "application/pdf" });
    if (!copia.error) {
      // upsert manual: si ya existía la fila (resubida), se actualiza.
      await admin
        .from("documentos_empleado")
        .delete()
        .eq("empresa_id", row.empresa_id)
        .eq("empleado_id", row.empleado_id)
        .eq("storage_path", destPath);
      await admin.from("documentos_empleado").insert({
        empresa_id: row.empresa_id,
        empleado_id: row.empleado_id,
        categoria: "contratos",
        nombre: nombreDoc,
        storage_path: destPath,
        tipo_mime: "application/pdf",
        tamano_bytes: buffer.length,
      });
    } else {
      console.error("[gestoria/baja] archivar en carpeta:", copia.error.message);
    }
  } catch (e) {
    console.error("[gestoria/baja] archivar en carpeta:", e);
  }

  // 3) Marca el documento como recibido.
  const campoPath = clave === "justificante" ? "justificante_path" : "certificado_path";
  const campoFecha = clave === "justificante" ? "justificante_subido_en" : "certificado_subido_en";
  await admin
    .from("gestoria_baja_doc_tokens")
    .update({ [campoPath]: stagingPath, [campoFecha]: new Date().toISOString() })
    .eq("id", row.id);

  // 4) Copia al TRABAJADOR por email. El último día ya suele estar Inactivo y sin
  //    acceso al sistema, así que el correo es su única vía de conservarlos.
  await enviarDocAlTrabajador(admin, row, meta.label, nombreDoc, buffer);

  return { ok: true };
}

/**
 * Recordatorio a la gestoría de los documentos pendientes de una baja.
 *
 * Avisa cuando el justificante (el obligatorio) sigue sin subir y:
 *   · falta UN DÍA para la fecha de baja (preventivo), o
 *   · la fecha de baja YA PASÓ (urgente).
 *
 * Lo segundo es clave: una baja comunicada el mismo día —o después— nunca
 * tendría su «día antes» y se quedaría muda para siempre.
 *
 * Vive aquí y no en su propio cron a propósito: Vercel limita los crons diarios
 * del plan y añadir uno más bloquearía TODOS los despliegues. Lo invoca el cron
 * de gestoría ya existente.
 */
export async function procesarRecordatoriosDocsBaja(
  admin: SupabaseClient,
): Promise<{ enviados: number }> {
  const hoy = new Date().toISOString().slice(0, 10);
  let enviados = 0;

  const { data: pendientes } = await admin
    .from("gestoria_baja_doc_tokens")
    .select("id, empresa_id, empleado_id, token_hash, ultimo_dia, expira_en")
    .is("justificante_subido_en", null)
    .is("recordatorio_en", null);

  for (const tk of pendientes ?? []) {
    try {
      const ultimoDia = tk.ultimo_dia as string;
      if (new Date(tk.expira_en as string).getTime() < Date.now()) continue;

      const diasHasta = Math.round(
        (new Date(`${ultimoDia}T00:00:00Z`).getTime() - new Date(`${hoy}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      if (diasHasta > 1) continue;
      const vencido = diasHasta < 0;

      const empresaId = tk.empresa_id as string;
      const { data: emp } = await admin
        .from("empleados")
        .select("nombre, apellidos, dni_nie")
        .eq("id", tk.empleado_id)
        .maybeSingle();
      const { data: empresa } = await admin
        .from("empresas")
        .select("nombre")
        .eq("id", empresaId)
        .maybeSingle();
      const nombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "el trabajador";
      const empresaNombre = (empresa?.nombre as string) ?? "la empresa";

      const enlace = urlRecordatorioDocsBaja(tk.token_hash as string);
      const botonHtml = botonDocsBajaHtml(enlace, { recordatorio: true });

      const { resolverDestinatario } = await import(
        "@/features/rrhh/services/email-plantillas/resolver"
      );
      const dst = await resolverDestinatario(admin, empresaId, "departamento", "correoGestoria", null);
      const to = [dst.to, dst.cc].filter(Boolean).join(", ");
      if (!to) continue;

      const fechaES = ultimoDia.split("-").reverse().join("/");
      const subject = vencido
        ? `⚠️ Urgente: faltan los documentos de la baja de ${nombre} · ${empresaNombre}`
        : `Recordatorio: documentos de la baja de ${nombre} (mañana) · ${empresaNombre}`;
      const html = `
        <p>Nos falta el <b>justificante de baja de la Seguridad Social</b> de
        <b>${nombre}</b>${emp?.dni_nie ? ` (DNI/NIE ${emp.dni_nie})` : ""}.</p>
        <p${vencido ? ' style="color:#b91c1c"' : ""}>
          ${
            vencido
              ? `Su baja tenía fecha del <b>${fechaES}</b> y esa fecha <b>ya ha pasado</b>. Sin el justificante no podemos acreditar la baja ni su causa.`
              : `Su baja es el <b>${fechaES}</b>. Te agradeceríamos que nos adjuntes la documentación en cuanto la tengas.`
          }
        </p>
        ${botonHtml}
        <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
      const text =
        `Faltan los documentos de la baja de ${nombre} (fecha de baja: ${fechaES}). ` +
        `Súbelos aquí: ${enlace}`;

      const res = await sendEmail({ to, subject, html, text, empresaId });
      if (!res.ok) continue;

      await admin
        .from("gestoria_baja_doc_tokens")
        .update({ recordatorio_en: new Date().toISOString() })
        .eq("id", tk.id);
      enviados++;

      const { notificarRrhhGestoria } = await import(
        "@/features/rrhh/services/gestoria/gestoria-contrato"
      );
      await notificarRrhhGestoria({
        empresaId,
        tipo: "gestoria_recordatorio",
        titulo: `Documentos de baja pendientes: ${nombre}`,
        mensaje: vencido
          ? `La baja de ${nombre} (${fechaES}) ya pasó y la gestoría aún no ha subido el justificante. Se le ha reenviado el enlace.`
          : `La baja de ${nombre} es el ${fechaES} y faltan los documentos. Se ha recordado a la gestoría.`,
        empleadoId: tk.empleado_id as string,
        dedupeKey: `gestoria_baja_docs:${tk.id}`,
      });
    } catch (e) {
      console.error("[gestoria/baja] recordatorio:", e);
    }
  }

  return { enviados };
}

/** Envía el documento al trabajador a su email PERSONAL (el corporativo puede
 *  estar ya cortado tras la baja). Best-effort: nunca tumba la subida. */
async function enviarDocAlTrabajador(
  admin: SupabaseClient,
  row: DocsBajaRow,
  etiqueta: string,
  nombreArchivo: string,
  pdf: Buffer,
): Promise<void> {
  try {
    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, email_personal, email_empresa")
      .eq("id", row.empleado_id)
      .maybeSingle();
    // Personal PRIMERO: tras la baja el corporativo suele estar cerrado.
    const to = (emp?.email_personal as string | null) || (emp?.email_empresa as string | null);
    if (!to) return;

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre")
      .eq("id", row.empresa_id)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "la empresa";
    const nombre = `${(emp?.nombre as string) ?? ""}`.trim() || "Hola";

    const html = `
      <p>${nombre},</p>
      <p>Adjuntamos tu <b>${etiqueta.toLowerCase()}</b> relativo al fin de tu relación laboral con
      ${empresaNombre}.</p>
      <p>Guarda este documento: lo necesitarás para cualquier gestión ante la Seguridad Social
      o el SEPE.</p>
      <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
    const text =
      `${nombre},\n\nAdjuntamos tu ${etiqueta.toLowerCase()} relativo al fin de tu relación laboral ` +
      `con ${empresaNombre}. Guarda este documento: lo necesitarás para cualquier gestión ante la ` +
      `Seguridad Social o el SEPE.`;

    const res = await sendEmail({
      to,
      subject: `${etiqueta} · ${empresaNombre}`,
      html,
      text,
      empresaId: row.empresa_id,
      attachments: [{ filename: nombreArchivo, content: pdf, contentType: "application/pdf" }],
    });
    if (res.ok) {
      await admin
        .from("gestoria_baja_doc_tokens")
        .update({ enviado_trabajador_en: new Date().toISOString() })
        .eq("id", row.id);
    }
  } catch (e) {
    console.error("[gestoria/baja] envío al trabajador:", e);
  }
}
