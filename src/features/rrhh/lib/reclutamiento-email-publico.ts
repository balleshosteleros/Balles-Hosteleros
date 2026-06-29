/**
 * Envío del correo de confirmación al candidato cuando se inscribe desde el
 * portal público de empleo (estado inicial `nuevo`).
 *
 * El portal de empleo es PÚBLICO: no hay sesión, así que no se puede usar el
 * flujo del Kanban (`enviarReclutamientoFaseEmail`, que parte de `ctx()`/sesión).
 * Este helper resuelve la plantilla del estado `nuevo` con el SERVICE CLIENT
 * (mismo cliente que usa la API de candidatura) replicando la cadena de
 * resolución estándar: override por vacante → plantilla de estados de la vacante
 * → plantilla de estados predeterminada de la empresa.
 *
 * Best-effort: NUNCA lanza. Si no hay plantilla, está desactivada, falta email o
 * el transporte SMTP no está configurado, devuelve `{ sent: false, reason }` y
 * el alta de la candidatura sigue su curso sin romperse.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  sustituirVariablesReclutamiento,
  parsearEnlacesCuerpo,
} from "@/features/rrhh/lib/reclutamiento-email";

type Service = SupabaseClient;

const ESTADO_NUEVO = "nuevo";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodyToHtml(text: string): string {
  const html = parsearEnlacesCuerpo(text)
    .map((seg) =>
      seg.type === "link"
        ? `<a href="${escapeHtml(seg.href)}" target="_blank" rel="noreferrer" style="color:#2563eb;text-decoration:underline">${escapeHtml(seg.text)}</a>`
        : escapeHtml(seg.value).replace(/\n/g, "<br>"),
    )
    .join("");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:600px;margin:0 auto;padding:24px">${html}</div>`;
}

/** Resuelve la plantilla del estado `nuevo` para la vacante de un candidato. */
async function resolverPlantillaNuevo(
  supabase: Service,
  empresaId: string,
  vacanteId: string,
): Promise<{ asunto: string; cuerpo: string; activa: boolean } | null> {
  const { data: vac } = await supabase
    .from("vacantes")
    .select("plantilla_estado_id, email_plantillas")
    .eq("id", vacanteId)
    .maybeSingle();

  const overrides = (vac?.email_plantillas ?? {}) as Record<string, string | null>;
  let emailId: string | null = overrides[ESTADO_NUEVO] ?? null;

  if (!emailId) {
    let plantillaEstadoId = (vac?.plantilla_estado_id as string | null) ?? null;
    if (!plantillaEstadoId) {
      const { data: def } = await supabase
        .from("reclutamiento_plantillas_estado")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("es_predeterminada", true)
        .maybeSingle();
      plantillaEstadoId = (def?.id as string | null) ?? null;
    }
    if (plantillaEstadoId) {
      const { data: pt } = await supabase
        .from("reclutamiento_plantillas_estado")
        .select("estados")
        .eq("id", plantillaEstadoId)
        .maybeSingle();
      const items = (pt?.estados ?? []) as Array<{ key: string; email_plantilla_id?: string | null }>;
      emailId = items.find((it) => it.key === ESTADO_NUEVO)?.email_plantilla_id ?? null;
    }
  }
  if (!emailId) return null;

  const { data: tpl } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("asunto, cuerpo, activa")
    .eq("id", emailId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!tpl) return null;
  return {
    asunto: tpl.asunto as string,
    cuerpo: tpl.cuerpo as string,
    activa: tpl.activa as boolean,
  };
}

/** Variables de plantilla (candidato + vacante + empresa) con el service client. */
async function buildVarsPublico(
  supabase: Service,
  empresaId: string,
  candidato: { nombre: string; apellidos: string; email: string; telefono: string },
  vacante: { titulo: string | null; ubicacion: string | null; tipo_jornada: string | null; departamento_id: string | null },
): Promise<Record<string, string>> {
  const nombreCompleto = [candidato.nombre, candidato.apellidos].filter(Boolean).join(" ").trim();

  let departamentoNombre = "";
  if (vacante.departamento_id) {
    const { data: dep } = await supabase
      .from("departamentos")
      .select("nombre")
      .eq("id", vacante.departamento_id)
      .maybeSingle();
    departamentoNombre = (dep?.nombre as string | null) ?? "";
  }

  // Datos de empresa: igual que `buildReclutamientoEmailVars` (correo/teléfono/web
  // viven en el JSON `datos_generales`; dirección y correo tienen también columna).
  const { data: emp } = await supabase
    .from("empresas")
    .select("nombre, email_contacto, direccion, datos_generales")
    .eq("id", empresaId)
    .maybeSingle();
  const dg = (emp?.datos_generales as Record<string, unknown> | null) ?? {};
  const dgStr = (k: string) => {
    const v = dg[k];
    return typeof v === "string" ? v : "";
  };

  return {
    candidato_nombre: candidato.nombre,
    candidato_apellidos: candidato.apellidos,
    candidato_nombre_completo: nombreCompleto || candidato.nombre,
    candidato_email: candidato.email,
    candidato_telefono: candidato.telefono,
    vacante_nombre: vacante.titulo ?? "",
    vacante_ubicacion: vacante.ubicacion ?? "",
    departamento_nombre: departamentoNombre,
    tipo_jornada: vacante.tipo_jornada ?? "",
    empresa_nombre: (emp?.nombre as string | null) ?? "",
    empresa_email:
      dgStr("correoRrhh") ||
      ((emp?.email_contacto as string | null) ?? "") ||
      dgStr("correoGeneral"),
    empresa_telefono: dgStr("telefonoPrincipal") || dgStr("telefonoSecundario"),
    empresa_web: dgStr("web"),
    empresa_direccion: dgStr("direccionLocal") || ((emp?.direccion as string | null) ?? ""),
  };
}

/**
 * Envía el correo «Nuevo» al candidato recién inscrito. Best-effort.
 */
export async function enviarEmailCandidaturaNueva(
  supabase: Service,
  params: {
    empresaId: string;
    candidato: { nombre: string; apellidos: string; email: string; telefono: string };
    vacante: { id: string; titulo: string | null; ubicacion: string | null; tipo_jornada: string | null; departamento_id: string | null };
  },
): Promise<{ sent: boolean; reason?: string; asunto?: string }> {
  const { empresaId, candidato, vacante } = params;
  if (!candidato.email) return { sent: false, reason: "El candidato no tiene email" };

  const tpl = await resolverPlantillaNuevo(supabase, empresaId, vacante.id);
  if (!tpl) return { sent: false, reason: "Sin plantilla «Nuevo» asociada" };
  if (!tpl.activa) return { sent: false, reason: "Plantilla «Nuevo» desactivada" };

  // Firma corporativa (cabecera isotipo + pie). Default ON si no hay config.
  const { data: cfg } = await supabase
    .from("reclutamiento_config")
    .select("emails_firma_corporativa")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const firma = (cfg?.emails_firma_corporativa as boolean | null) ?? true;

  const vars = await buildVarsPublico(supabase, empresaId, candidato, vacante);
  const subject = sustituirVariablesReclutamiento(tpl.asunto, vars);
  const bodyText = sustituirVariablesReclutamiento(tpl.cuerpo, vars);

  const empresaNombre = vars.empresa_nombre || "la empresa";
  const pieText =
    "Este mensaje se ha enviado de forma automática desde una dirección que no admite respuestas. Por favor, no respondas a este correo.";
  const html = firma
    ? bodyToHtml(bodyText) +
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:0 24px 24px"><p style="color:#9ca3af;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;margin-top:8px;padding-top:12px">${escapeHtml(pieText)}</p></div>`
    : bodyToHtml(bodyText);

  const res = await sendEmail({
    to: candidato.email,
    subject,
    html,
    text: firma ? `${bodyText}\n\n—\n${pieText}` : bodyText,
    fromName: empresaNombre,
    empresaId,
    brandHeader: firma,
  });
  if (res.ok) return { sent: true, asunto: subject };
  if (!res.configured) return { sent: false, reason: "Sin transporte de email configurado" };
  return { sent: false, reason: res.error };
}
