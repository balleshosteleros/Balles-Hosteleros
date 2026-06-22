"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { sendEmail } from "@/lib/email/send";
import { sustituirVariablesReclutamiento } from "@/features/rrhh/lib/reclutamiento-email";
import {
  RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED,
  RECLUTAMIENTO_EMAIL_PLANTILLA_ESTADOS,
} from "@/lib/seeds/reclutamiento-email-plantillas";
import {
  ESTADOS_CONFIG,
  FASES_ORDER,
  getFasePrincipal,
  type EstadoReclutamiento,
  type FasePrincipal,
} from "@/features/rrhh/data/reclutamiento";

export interface ReclutamientoEmailPlantilla {
  estado: EstadoReclutamiento;
  fase: FasePrincipal;
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa: boolean;
}

type ActionResult = { ok: true } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/**
 * Devuelve las 10 plantillas en el orden del pipeline. Si por cualquier motivo
 * faltase alguna fila en BD, completa el hueco con el seed canónico (lectura
 * tolerante; la escritura sigue siendo aditiva en `syncSeeds…`).
 */
export async function listReclutamientoEmailPlantillas(): Promise<
  ReclutamientoEmailPlantilla[]
> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data, error } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("estado, asunto, cuerpo, activa")
    .eq("empresa_id", empresaId);
  if (error) {
    console.error("[reclutamiento-email-plantillas] list:", error.message);
    return [];
  }

  const porEstado = new Map<EstadoReclutamiento, {
    asunto: string;
    cuerpo: string;
    activa: boolean;
  }>();
  for (const r of data ?? []) {
    porEstado.set(r.estado as EstadoReclutamiento, {
      asunto: r.asunto as string,
      cuerpo: r.cuerpo as string,
      activa: r.activa as boolean,
    });
  }

  return FASES_ORDER.map((estado) => {
    const fila = porEstado.get(estado);
    const seed = RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED.find((s) => s.estado === estado);
    return {
      estado,
      fase: getFasePrincipal(estado),
      nombre: ESTADOS_CONFIG[estado].label,
      asunto: fila?.asunto ?? seed?.asunto ?? "",
      cuerpo: fila?.cuerpo ?? seed?.cuerpo ?? "",
      activa: fila?.activa ?? seed?.activa ?? false,
    };
  });
}

export async function updateReclutamientoEmailPlantilla(
  estado: EstadoReclutamiento,
  patch: { asunto: string; cuerpo: string; activa?: boolean },
): Promise<ActionResult> {
  if (!RECLUTAMIENTO_EMAIL_PLANTILLA_ESTADOS.has(estado)) {
    return { ok: false, error: "Estado no válido" };
  }
  const asunto = patch.asunto.trim();
  const cuerpo = patch.cuerpo.trim();
  if (!asunto) return { ok: false, error: "El asunto no puede estar vacío" };
  if (!cuerpo) return { ok: false, error: "El cuerpo no puede estar vacío" };

  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const seed = RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED.find((s) => s.estado === estado);
  const { error } = await supabase
    .from("reclutamiento_email_plantillas")
    .upsert(
      {
        empresa_id: empresaId,
        estado,
        asunto,
        cuerpo,
        activa: patch.activa ?? seed?.activa ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id,estado" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/rrhh/reclutamiento");
  return { ok: true };
}

export async function toggleReclutamientoEmailPlantillaActiva(
  estado: EstadoReclutamiento,
  activa: boolean,
): Promise<ActionResult> {
  if (!RECLUTAMIENTO_EMAIL_PLANTILLA_ESTADOS.has(estado)) {
    return { ok: false, error: "Estado no válido" };
  }
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const seed = RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED.find((s) => s.estado === estado);
  if (!seed) return { ok: false, error: "Estado no válido" };

  // Lee lo que haya para conservar el texto editado por el cliente.
  const { data: actual } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("asunto, cuerpo")
    .eq("empresa_id", empresaId)
    .eq("estado", estado)
    .maybeSingle();

  const { error } = await supabase
    .from("reclutamiento_email_plantillas")
    .upsert(
      {
        empresa_id: empresaId,
        estado,
        asunto: (actual?.asunto as string | undefined) ?? seed.asunto,
        cuerpo: (actual?.cuerpo as string | undefined) ?? seed.cuerpo,
        activa,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id,estado" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/rrhh/reclutamiento");
  return { ok: true };
}

/** Resetea una plantilla a su valor canónico del seed. */
export async function resetReclutamientoEmailPlantilla(
  estado: EstadoReclutamiento,
): Promise<ActionResult> {
  const seed = RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED.find((s) => s.estado === estado);
  if (!seed) return { ok: false, error: "Estado no válido" };
  return updateReclutamientoEmailPlantilla(estado, {
    asunto: seed.asunto,
    cuerpo: seed.cuerpo,
    activa: seed.activa,
  });
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
 * Envía el correo correspondiente al estado destino de un candidato. Es la
 * fuente autoritativa: relee la plantilla de BD (respeta ediciones y el flag
 * `activa`) y resuelve los códigos con los datos reales. NUNCA lanza: devuelve
 * `{ sent, reason }` para que el llamador informe sin bloquear el cambio de fase.
 *
 * El disparo es a elección del usuario (diálogo de confirmación en el Kanban);
 * esta acción solo se invoca cuando el usuario acepta enviar.
 */
export async function enviarReclutamientoFaseEmail(
  candidatoId: string,
  estado: EstadoReclutamiento,
): Promise<{ sent: boolean; reason?: string }> {
  if (!RECLUTAMIENTO_EMAIL_PLANTILLA_ESTADOS.has(estado)) {
    return { sent: false, reason: "Estado no válido" };
  }
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { sent: false, reason: "Sin empresa activa" };

  // Plantilla del tenant (con fallback al seed si faltara la fila).
  const { data: tpl } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("asunto, cuerpo, activa")
    .eq("empresa_id", empresaId)
    .eq("estado", estado)
    .maybeSingle();
  const seed = RECLUTAMIENTO_EMAIL_PLANTILLAS_SEED.find((s) => s.estado === estado);
  const asuntoTpl = (tpl?.asunto as string | undefined) ?? seed?.asunto;
  const cuerpoTpl = (tpl?.cuerpo as string | undefined) ?? seed?.cuerpo;
  const activa = tpl?.activa ?? seed?.activa ?? false;
  if (!asuntoTpl || !cuerpoTpl) return { sent: false, reason: "Sin plantilla configurada" };
  if (!activa) return { sent: false, reason: "Plantilla desactivada" };

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
  const subject = sustituirVariablesReclutamiento(asuntoTpl, vars);
  const bodyText = sustituirVariablesReclutamiento(cuerpoTpl, vars);
  const html = bodyToHtml(bodyText);

  const res = await sendEmail({ to, subject, html, text: bodyText });
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
    .select("nombre, email_contacto, direccion, datos_generales")
    .eq("id", empresaId)
    .maybeSingle();
  const dg = (emp?.datos_generales as Record<string, unknown> | null) ?? {};
  const dgStr = (k: string) => {
    const v = dg[k];
    return typeof v === "string" ? v : "";
  };

  const vars: Record<string, string> = {
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
