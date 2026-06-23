"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { sendEmail } from "@/lib/email/send";
import { sustituirVariablesReclutamiento } from "@/features/rrhh/lib/reclutamiento-email";
import { type EstadoReclutamiento } from "@/features/rrhh/data/reclutamiento";

/**
 * Biblioteca de plantillas de email del RECLUTAMIENTO. Cada plantilla es SUELTA
 * (identificada por `nombre`), no está atada a un estado. La asociación
 * email↔estado vive en la plantilla de estados (`estados[].email_plantilla_id`)
 * y, como override por vacante, en `vacantes.email_plantillas`.
 */
export interface ReclutamientoEmailPlantilla {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa: boolean;
}

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

function dupMsg(error: { code?: string; message: string }): string {
  return error.code === "23505" ? "Ya existe una plantilla con ese nombre" : error.message;
}

// ─────────────────────────────────────────────────────────────────────────
// CRUD de la biblioteca
// ─────────────────────────────────────────────────────────────────────────
export async function listReclutamientoEmailPlantillas(): Promise<
  ReclutamientoEmailPlantilla[]
> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data, error } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("id, nombre, asunto, cuerpo, activa")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[reclutamiento-email-plantillas] list:", error.message);
    return [];
  }
  return (data ?? []) as ReclutamientoEmailPlantilla[];
}

export async function createReclutamientoEmailPlantilla(input: {
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa?: boolean;
}): Promise<CreateResult> {
  const nombre = input.nombre.trim();
  const asunto = input.asunto.trim();
  const cuerpo = input.cuerpo.trim();
  if (!nombre) return { ok: false, error: "El nombre no puede estar vacío" };
  if (!asunto) return { ok: false, error: "El asunto no puede estar vacío" };
  if (!cuerpo) return { ok: false, error: "El cuerpo no puede estar vacío" };

  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data, error } = await supabase
    .from("reclutamiento_email_plantillas")
    .insert({ empresa_id: empresaId, nombre, asunto, cuerpo, activa: input.activa ?? true })
    .select("id")
    .single();
  if (error) return { ok: false, error: dupMsg(error) };

  revalidatePath("/rrhh/reclutamiento");
  return { ok: true, id: data.id as string };
}

export async function updateReclutamientoEmailPlantilla(
  id: string,
  patch: { nombre?: string; asunto?: string; cuerpo?: string; activa?: boolean },
): Promise<ActionResult> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nombre !== undefined) {
    const n = patch.nombre.trim();
    if (!n) return { ok: false, error: "El nombre no puede estar vacío" };
    update.nombre = n;
  }
  if (patch.asunto !== undefined) {
    const a = patch.asunto.trim();
    if (!a) return { ok: false, error: "El asunto no puede estar vacío" };
    update.asunto = a;
  }
  if (patch.cuerpo !== undefined) {
    const c = patch.cuerpo.trim();
    if (!c) return { ok: false, error: "El cuerpo no puede estar vacío" };
    update.cuerpo = c;
  }
  if (patch.activa !== undefined) update.activa = patch.activa;

  const { error } = await supabase
    .from("reclutamiento_email_plantillas")
    .update(update)
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: dupMsg(error) };

  revalidatePath("/rrhh/reclutamiento");
  return { ok: true };
}

export async function toggleReclutamientoEmailPlantillaActiva(
  id: string,
  activa: boolean,
): Promise<ActionResult> {
  return updateReclutamientoEmailPlantilla(id, { activa });
}

export async function deleteReclutamientoEmailPlantilla(id: string): Promise<ActionResult> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  // Limpia las referencias a esta plantilla en las plantillas de estado y en las
  // vacantes para no dejar asociaciones colgando.
  await limpiarReferenciasEmail(supabase, empresaId, id);

  const { error } = await supabase
    .from("reclutamiento_email_plantillas")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/rrhh/reclutamiento");
  return { ok: true };
}

export async function duplicateReclutamientoEmailPlantilla(id: string): Promise<CreateResult> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data: orig } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("nombre, asunto, cuerpo, activa")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!orig) return { ok: false, error: "Plantilla no encontrada" };

  const { data: existentes } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("nombre")
    .eq("empresa_id", empresaId);
  const usados = new Set((existentes ?? []).map((r) => r.nombre as string));
  let nombre = `${orig.nombre} (copia)`;
  let n = 2;
  while (usados.has(nombre)) nombre = `${orig.nombre} (copia) ${n++}`;

  return createReclutamientoEmailPlantilla({
    nombre,
    asunto: orig.asunto as string,
    cuerpo: orig.cuerpo as string,
    activa: orig.activa as boolean,
  });
}

/** Borra el `email_plantilla_id` que apunte a `emailId` en estados y vacantes. */
async function limpiarReferenciasEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  emailId: string,
): Promise<void> {
  // Plantillas de estado.
  const { data: plantillas } = await supabase
    .from("reclutamiento_plantillas_estado")
    .select("id, estados")
    .eq("empresa_id", empresaId);
  for (const p of plantillas ?? []) {
    const items = (p.estados ?? []) as Array<Record<string, unknown>>;
    if (!items.some((it) => it.email_plantilla_id === emailId)) continue;
    const next = items.map((it) =>
      it.email_plantilla_id === emailId ? { ...it, email_plantilla_id: null } : it,
    );
    await supabase
      .from("reclutamiento_plantillas_estado")
      .update({ estados: next, updated_at: new Date().toISOString() })
      .eq("id", p.id as string);
  }

  // Overrides por vacante.
  const { data: vacantes } = await supabase
    .from("vacantes")
    .select("id, email_plantillas")
    .eq("empresa_id", empresaId);
  for (const v of vacantes ?? []) {
    const map = (v.email_plantillas ?? {}) as Record<string, string | null>;
    if (!Object.values(map).includes(emailId)) continue;
    const next: Record<string, string | null> = {};
    for (const [k, val] of Object.entries(map)) if (val !== emailId) next[k] = val;
    await supabase.from("vacantes").update({ email_plantillas: next }).eq("id", v.id as string);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Resolución email ⇐ estado (vía vacante → plantilla de estados / override)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Devuelve la plantilla de email que corresponde al estado destino de un
 * candidato: primero el override de la vacante (`email_plantillas[estado]`), si
 * no, el email por defecto del estado en la plantilla de estados de la vacante.
 * Devuelve `null` si no hay email asociado.
 */
async function resolverEmailParaEstado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  candidatoId: string,
  estado: string,
): Promise<{ id: string; asunto: string; cuerpo: string; activa: boolean } | null> {
  const { data: cand } = await supabase
    .from("candidatos")
    .select("vacante_id")
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const vacanteId = (cand?.vacante_id as string | null) ?? null;
  if (!vacanteId) return null;

  const { data: vac } = await supabase
    .from("vacantes")
    .select("plantilla_estado_id, email_plantillas")
    .eq("id", vacanteId)
    .maybeSingle();

  const overrides = (vac?.email_plantillas ?? {}) as Record<string, string | null>;
  let emailId: string | null = overrides[estado] ?? null;

  if (!emailId) {
    // La vacante puede no tener una plantilla de estados asignada: en ese caso
    // se usa la plantilla predeterminada de la empresa. Así el email por estado
    // funciona sin necesidad de cablear cada vacante (presente y futuras).
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
      emailId = items.find((it) => it.key === estado)?.email_plantilla_id ?? null;
    }
  }
  if (!emailId) return null;

  const { data: tpl } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("id, asunto, cuerpo, activa")
    .eq("id", emailId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!tpl) return null;
  return {
    id: tpl.id as string,
    asunto: tpl.asunto as string,
    cuerpo: tpl.cuerpo as string,
    activa: tpl.activa as boolean,
  };
}

/**
 * Previsualización para el diálogo del Kanban: devuelve el asunto/cuerpo (sin
 * sustituir) y si está activa la plantilla asociada al estado destino. `null` si
 * no hay email asociado.
 */
export async function previewReclutamientoFaseEmail(
  candidatoId: string,
  estado: EstadoReclutamiento,
): Promise<{ asunto: string; cuerpo: string; activa: boolean } | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;
  const tpl = await resolverEmailParaEstado(supabase, empresaId, candidatoId, estado);
  if (!tpl) return null;
  return { asunto: tpl.asunto, cuerpo: tpl.cuerpo, activa: tpl.activa };
}

// ─── Envío del correo al cambiar de fase ────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodyToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) =>
    `<a href="${url}" target="_blank" rel="noreferrer" style="color:#2563eb;text-decoration:underline">${url}</a>`,
  );
  const html = linked.replace(/\n/g, "<br>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:600px;margin:0 auto;padding:24px">${html}</div>`;
}

/**
 * Envía el correo asociado al estado destino de un candidato. Resuelve la
 * plantilla vía la vacante (override por vacante o email por defecto del estado
 * en la plantilla de estados), respeta el flag `activa` y sustituye los códigos
 * con los datos reales. NUNCA lanza: devuelve `{ sent, reason }`.
 *
 * El disparo es a elección del usuario (diálogo de confirmación en el Kanban).
 */
export async function enviarReclutamientoFaseEmail(
  candidatoId: string,
  estado: EstadoReclutamiento,
): Promise<{ sent: boolean; reason?: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { sent: false, reason: "Sin empresa activa" };

  const tpl = await resolverEmailParaEstado(supabase, empresaId, candidatoId, estado);
  if (!tpl) return { sent: false, reason: "Sin plantilla de email asociada a este estado" };
  if (!tpl.activa) return { sent: false, reason: "Plantilla desactivada" };

  // Destinatario.
  const { data: cand } = await supabase
    .from("candidatos")
    .select("email")
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const to = (cand?.email as string | null) ?? "";
  if (!to) return { sent: false, reason: "El candidato no tiene email" };

  const vars = await buildReclutamientoEmailVars(candidatoId);
  const subject = sustituirVariablesReclutamiento(tpl.asunto, vars);
  const bodyText = sustituirVariablesReclutamiento(tpl.cuerpo, vars);

  // Pie automático: deja claro que es un correo no monitorizado y que no admite
  // respuestas (sin incluir ninguna dirección de contacto).
  const empresaNombre = vars.empresa_nombre || "la empresa";
  const pieText =
    "Este mensaje se ha enviado de forma automática desde una dirección que no admite respuestas. Por favor, no respondas a este correo.";
  // Cabecera con el logo de la empresa centrado (si hay logo configurado).
  const logoHtml = vars.empresa_logo
    ? `<div style="text-align:center;max-width:600px;margin:0 auto;padding:28px 24px 4px"><img src="${vars.empresa_logo}" alt="${escapeHtml(empresaNombre)}" style="max-height:72px;max-width:240px;height:auto;width:auto;display:inline-block" /></div>`
    : "";
  const html =
    logoHtml +
    bodyToHtml(bodyText) +
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:0 24px 24px"><p style="color:#9ca3af;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;margin-top:8px;padding-top:12px">${escapeHtml(pieText)}</p></div>`;

  const res = await sendEmail({
    to,
    subject,
    html,
    text: `${bodyText}\n\n—\n${pieText}`,
    fromName: empresaNombre,
  });
  if (res.ok) return { sent: true };
  if (!res.configured) return { sent: false, reason: "Sin transporte de email configurado" };
  return { sent: false, reason: res.error };
}

/**
 * Resuelve los CÓDIGOS de una plantilla con los datos reales de un candidato
 * (candidato + vacante + departamento + empresa). Devuelve el mapa `vars` listo
 * para `sustituirVariablesReclutamiento()`. Los códigos sin dato (reclutador,
 * fecha/hora de entrevista) se pueden completar vía `overrides`.
 */
export async function buildReclutamientoEmailVars(
  candidatoId: string,
  overrides: Record<string, string> = {},
): Promise<Record<string, string>> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ...overrides };

  const { data: cand } = await supabase
    .from("candidatos")
    .select("nombre, apellidos, email, telefono, vacante_id")
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const nombre = (cand?.nombre as string | null) ?? "";
  const apellidos = (cand?.apellidos as string | null) ?? "";
  const nombreCompleto = [nombre, apellidos].filter(Boolean).join(" ").trim();

  let vacanteNombre = "";
  let vacanteUbicacion = "";
  let tipoJornada = "";
  let departamentoNombre = "";
  const vacanteId = cand?.vacante_id as string | null;
  if (vacanteId) {
    const { data: vac } = await supabase
      .from("vacantes")
      .select("titulo, ubicacion, tipo_jornada, departamento_id")
      .eq("id", vacanteId)
      .maybeSingle();
    vacanteNombre = (vac?.titulo as string | null) ?? "";
    vacanteUbicacion = (vac?.ubicacion as string | null) ?? "";
    tipoJornada = (vac?.tipo_jornada as string | null) ?? "";
    const deptoId = vac?.departamento_id as string | null;
    if (deptoId) {
      const { data: dep } = await supabase
        .from("departamentos")
        .select("nombre")
        .eq("id", deptoId)
        .maybeSingle();
      departamentoNombre = (dep?.nombre as string | null) ?? "";
    }
  }

  const { data: emp } = await supabase
    .from("empresas")
    .select("nombre, email_contacto, direccion, datos_generales, logo_url, isotipo_url")
    .eq("id", empresaId)
    .maybeSingle();
  const dg = (emp?.datos_generales as Record<string, unknown> | null) ?? {};
  const dgStr = (k: string) => {
    const v = dg[k];
    return typeof v === "string" ? v : "";
  };
  // Logo para la cabecera del email. Solo URLs absolutas https funcionan en correo.
  const logoCandidato =
    ((emp?.logo_url as string | null) ?? "") ||
    dgStr("logoUrl") ||
    ((emp?.isotipo_url as string | null) ?? "");
  const empresaLogo = /^https?:\/\//i.test(logoCandidato) ? logoCandidato : "";

  const vars: Record<string, string> = {
    empresa_logo: empresaLogo,
    candidato_nombre: nombre,
    candidato_apellidos: apellidos,
    candidato_nombre_completo: nombreCompleto || nombre,
    candidato_email: (cand?.email as string | null) ?? "",
    candidato_telefono: (cand?.telefono as string | null) ?? "",
    vacante_nombre: vacanteNombre,
    vacante_ubicacion: vacanteUbicacion,
    departamento_nombre: departamentoNombre,
    tipo_jornada: tipoJornada,
    empresa_nombre: (emp?.nombre as string | null) ?? "",
    empresa_email:
      dgStr("correoRrhh") ||
      ((emp?.email_contacto as string | null) ?? "") ||
      dgStr("correoGeneral"),
    empresa_telefono: dgStr("telefonoPrincipal") || dgStr("telefonoSecundario"),
    empresa_web: dgStr("web"),
    empresa_direccion: dgStr("direccionLocal") || ((emp?.direccion as string | null) ?? ""),
    ...overrides,
  };
  return vars;
}
