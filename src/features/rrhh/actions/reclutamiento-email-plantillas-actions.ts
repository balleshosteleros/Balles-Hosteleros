"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { sendEmail } from "@/lib/email/send";
import { sustituirVariablesReclutamiento, parsearEnlacesCuerpo } from "@/features/rrhh/lib/reclutamiento-email";
import {
  type EstadoReclutamiento,
  ESTADOS_CONFIG,
  EMAIL_PLANTILLAS_FASE,
} from "@/features/rrhh/data/reclutamiento";
import { getReclutamientoConfigGeneral } from "@/features/rrhh/actions/gestoria-actions";
import {
  PLANTILLAS_RESERVADAS_POR_ESTADO,
  PLANTILLAS_ONBOARDING_PROTEGIDAS,
  destinoDePlantilla,
  type DestinoPlantilla,
} from "@/features/rrhh/lib/plantillas-onboarding";

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
    // Las plantillas del sistema no se pueden renombrar: todo el flujo de
    // onboarding las localiza por su nombre exacto (dispara el correo, pinta el
    // destinatario, protege del borrado). Solo se bloquea si el nombre cambia
    // realmente, para no rechazar guardados que no tocan el nombre.
    const { data: actual } = await supabase
      .from("reclutamiento_email_plantillas")
      .select("nombre")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const nombreActual = (actual?.nombre as string | null) ?? null;
    if (
      nombreActual &&
      n !== nombreActual &&
      PLANTILLAS_ONBOARDING_PROTEGIDAS.has(nombreActual)
    ) {
      return { ok: false, error: "El nombre de una plantilla del sistema no se puede cambiar" };
    }
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

  // Las plantillas reservadas del onboarding (gestoría, contratos, prueba) NUNCA
  // se pueden borrar: las dispara el sistema. Defensa en servidor además de la UI.
  const { data: actual } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("nombre")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (actual?.nombre && PLANTILLAS_ONBOARDING_PROTEGIDAS.has(actual.nombre as string)) {
    return { ok: false, error: "Esta plantilla es del sistema y no se puede borrar" };
  }

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
 * Previsualización para el diálogo del Kanban: devuelve el asunto/cuerpo y si
 * está activa la plantilla asociada al estado destino. `null` si no hay email
 * asociado.
 *
 * Las variables (`{{empresa_email}}`, `{{empresa_nombre}}`, etc.) se sustituyen
 * aquí con los DATOS REALES de la empresa/candidato/vacante (mismo motor que el
 * envío real, `buildReclutamientoEmailVars`), para que la previa muestre
 * exactamente lo que recibirá el candidato y no datos de ejemplo.
 */
export async function previewReclutamientoFaseEmail(
  candidatoId: string,
  estado: EstadoReclutamiento,
): Promise<{ asunto: string; cuerpo: string; activa: boolean } | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;
  const tpl = await resolverEmailParaEstado(supabase, empresaId, candidatoId, estado);
  if (!tpl) return null;

  const vars = await buildReclutamientoEmailVars(candidatoId);

  // Paso «Documentación»: resuelve {{enlace_documentacion}} igual que el envío,
  // pero SIN crear el token todavía (la previa no debe tener efectos). Si aún no
  // existe, deja un texto-placeholder legible en lugar del enlace real.
  if (estado === "documentacion") {
    const { data: cand } = await supabase
      .from("candidatos")
      .select("documentacion_token")
      .eq("id", candidatoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const token = (cand?.documentacion_token as string | null) ?? null;
    if (token) {
      const { enlaceDocumentacion } = await import(
        "@/features/rrhh/lib/documentacion-candidato"
      );
      vars.enlace_documentacion = enlaceDocumentacion(token);
    } else {
      vars.enlace_documentacion = "(se generará un enlace personal al enviar)";
    }
  }

  // Fase «Formación»: resuelve {{enlace_formacion}} con la URL configurada.
  if (estado === "formacion") {
    const { data: cfgRow } = await supabase
      .from("reclutamiento_config")
      .select("formacion_url")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    vars.enlace_formacion =
      (cfgRow?.formacion_url as string | null) || "(configura la URL de formación en Ajustes → RRHH → Reclutamiento)";
  }

  return {
    asunto: sustituirVariablesReclutamiento(tpl.asunto, vars),
    cuerpo: sustituirVariablesReclutamiento(tpl.cuerpo, vars),
    activa: tpl.activa,
  };
}

/**
 * Devuelve la lista de `key` de estados de una vacante que tienen un email
 * ACTIVO asociado (override por vacante o email por defecto del estado en la
 * plantilla de estados de la vacante, o la predeterminada de la empresa). Se usa
 * en el Kanban para marcar con un check verde qué columnas enviarán correo.
 */
export async function estadosConEmailDeVacante(
  vacanteId: string,
): Promise<string[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId || !vacanteId) return [];

  const { data: vac } = await supabase
    .from("vacantes")
    .select("plantilla_estado_id, email_plantillas")
    .eq("id", vacanteId)
    .maybeSingle();

  const overrides = (vac?.email_plantillas ?? {}) as Record<string, string | null>;

  // Plantilla de estados de la vacante; si no tiene, la predeterminada de la empresa.
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

  const emailPorEstadoPlantilla: Record<string, string | null> = {};
  if (plantillaEstadoId) {
    const { data: pt } = await supabase
      .from("reclutamiento_plantillas_estado")
      .select("estados")
      .eq("id", plantillaEstadoId)
      .maybeSingle();
    const items = (pt?.estados ?? []) as Array<{ key: string; email_plantilla_id?: string | null }>;
    for (const it of items) emailPorEstadoPlantilla[it.key] = it.email_plantilla_id ?? null;
  }

  // email_plantilla_id por estado (el override de la vacante gana).
  const idPorEstado: Record<string, string> = {};
  const keys = new Set([...Object.keys(overrides), ...Object.keys(emailPorEstadoPlantilla)]);
  for (const k of keys) {
    const id = overrides[k] ?? emailPorEstadoPlantilla[k] ?? null;
    if (id) idPorEstado[k] = id;
  }

  const ids = [...new Set(Object.values(idPorEstado))];
  if (ids.length === 0) return [];

  // Solo cuentan las plantillas que existen y están activas.
  const { data: tpls } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("id, activa")
    .eq("empresa_id", empresaId)
    .in("id", ids);
  const activos = new Set((tpls ?? []).filter((t) => t.activa).map((t) => t.id as string));

  return Object.entries(idPorEstado)
    .filter(([, id]) => activos.has(id))
    .map(([estado]) => estado);
}

// ─────────────────────────────────────────────────────────────────────────
// Detalle de plantillas por estado (para el popover del icono de email)
// ─────────────────────────────────────────────────────────────────────────
/** Una plantilla asociada a un estado del pipeline. */
export interface PlantillaFaseInfo {
  /** Nombre visible de la plantilla. */
  nombre: string;
  /** Si está activa (se envía). Las inactivas se listan en gris. */
  activa: boolean;
  /** Destinatario real: candidato, gestoría o RRHH (icono informativo). */
  destino: DestinoPlantilla;
}

/**
 * Devuelve, por cada estado del pipeline de una vacante, la LISTA de plantillas
 * de email que envía ese estado (con su nombre, si está activa y su destino).
 * Combina:
 *   · La plantilla de estado asociada (override de la vacante o plantilla de
 *     estados / predeterminada de la empresa) → 1 correo al candidato.
 *   · Las plantillas RESERVADAS del onboarding que dispara el sistema en fases
 *     fijas (Contratación: alta a gestoría + contrato interno + contrato
 *     oficial; Prueba: aviso a RRHH).
 *
 * Se usa en el Kanban para mostrar, al pulsar el icono de email de una columna,
 * QUÉ correo(s) se envían y a quién.
 */
export async function plantillasPorEstadoDeVacante(
  vacanteId: string,
): Promise<Record<string, PlantillaFaseInfo[]>> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId || !vacanteId) return {};

  const out: Record<string, PlantillaFaseInfo[]> = {};
  const push = (estado: string, info: PlantillaFaseInfo) => {
    (out[estado] ??= []).push(info);
  };

  // 1) Plantilla de estado asociada a cada estado (correo al candidato).
  const { data: vac } = await supabase
    .from("vacantes")
    .select("plantilla_estado_id, email_plantillas")
    .eq("id", vacanteId)
    .maybeSingle();

  const overrides = (vac?.email_plantillas ?? {}) as Record<string, string | null>;

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

  const emailPorEstadoPlantilla: Record<string, string | null> = {};
  if (plantillaEstadoId) {
    const { data: pt } = await supabase
      .from("reclutamiento_plantillas_estado")
      .select("estados")
      .eq("id", plantillaEstadoId)
      .maybeSingle();
    const items = (pt?.estados ?? []) as Array<{ key: string; email_plantilla_id?: string | null }>;
    for (const it of items) emailPorEstadoPlantilla[it.key] = it.email_plantilla_id ?? null;
  }

  const idPorEstado: Record<string, string> = {};
  const keys = new Set([...Object.keys(overrides), ...Object.keys(emailPorEstadoPlantilla)]);
  for (const k of keys) {
    const id = overrides[k] ?? emailPorEstadoPlantilla[k] ?? null;
    if (id) idPorEstado[k] = id;
  }

  // 2) Nombres reservados del onboarding a buscar por nombre.
  const nombresReservados = [
    ...new Set(Object.values(PLANTILLAS_RESERVADAS_POR_ESTADO).flat()),
  ];

  // Carga en bloque todas las plantillas implicadas (por id y por nombre).
  const ids = [...new Set(Object.values(idPorEstado))];
  const { data: porId } = ids.length
    ? await supabase
        .from("reclutamiento_email_plantillas")
        .select("id, nombre, activa")
        .eq("empresa_id", empresaId)
        .in("id", ids)
    : { data: [] as Array<{ id: string; nombre: string; activa: boolean }> };
  const { data: porNombre } = nombresReservados.length
    ? await supabase
        .from("reclutamiento_email_plantillas")
        .select("nombre, activa")
        .eq("empresa_id", empresaId)
        .in("nombre", nombresReservados)
    : { data: [] as Array<{ nombre: string; activa: boolean }> };

  const tplById = new Map(
    (porId ?? []).map((t) => [t.id as string, { nombre: t.nombre as string, activa: !!t.activa }]),
  );
  const tplByNombre = new Map(
    (porNombre ?? []).map((t) => [t.nombre as string, !!t.activa]),
  );

  // 2a) Plantilla de estado → correo al candidato.
  for (const [estado, id] of Object.entries(idPorEstado)) {
    const t = tplById.get(id);
    if (t) push(estado, { nombre: t.nombre, activa: t.activa, destino: destinoDePlantilla(t.nombre) });
  }

  // 2a-bis) Respaldo canónico: si un estado del candidato no tiene plantilla
  // configurada por la vacante/empresa, mostrar igualmente su correo por defecto
  // (catálogo `EMAIL_PLANTILLAS_FASE`). Sin esto, las fases sin plantilla de
  // estados asociada aparecían con el icono en gris y sin popover.
  for (const [estado, def] of Object.entries(EMAIL_PLANTILLAS_FASE)) {
    if (!def.activo) continue; // estados legacy/inactivos: no llevan correo
    if ((out[estado] ?? []).length > 0) continue; // ya resuelto por la vacante
    const nombre = ESTADOS_CONFIG[estado as EstadoReclutamiento]?.label ?? estado;
    push(estado, { nombre, activa: true, destino: "candidato" });
  }

  // 2b) Plantillas reservadas del sistema por fase fija.
  for (const [estado, nombres] of Object.entries(PLANTILLAS_RESERVADAS_POR_ESTADO)) {
    for (const nombre of nombres) {
      // No duplicar si la plantilla de estado ya apuntaba al mismo nombre.
      if ((out[estado] ?? []).some((p) => p.nombre === nombre)) continue;
      const activa = tplByNombre.has(nombre) ? tplByNombre.get(nombre)! : true;
      push(estado, { nombre, activa, destino: destinoDePlantilla(nombre) });
    }
  }

  return out;
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
  // Tokeniza en texto + enlaces (sintaxis `[texto](url)` y URLs sueltas) para
  // que el correo enviado coincida con la vista previa del editor.
  const html = parsearEnlacesCuerpo(text)
    .map((seg) =>
      seg.type === "link"
        ? `<a href="${escapeHtml(seg.href)}" target="_blank" rel="noreferrer" style="color:#2563eb;text-decoration:underline">${escapeHtml(seg.text)}</a>`
        : escapeHtml(seg.value).replace(/\n/g, "<br>"),
    )
    .join("");
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
  const { supabase, user, empresaId } = await ctx();
  if (!empresaId) return { sent: false, reason: "Sin empresa activa" };

  const tpl = await resolverEmailParaEstado(supabase, empresaId, candidatoId, estado);
  if (!tpl) return { sent: false, reason: "Sin plantilla de email asociada a este estado" };
  if (!tpl.activa) return { sent: false, reason: "Plantilla desactivada" };

  // Configuración general (Ajustes → RRHH → Reclutamiento):
  //  · firma corporativa = cabecera (isotipo) + pie del correo.
  //  · copia al reclutador = CC al usuario que está realizando el cambio.
  const cfg = (await getReclutamientoConfigGeneral()).data;
  const cc = cfg.emails_copia_reclutador ? (user?.email ?? undefined) : undefined;

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

  // Paso «Documentación»: genera (perezosamente) el token del candidato y resuelve
  // el placeholder {{enlace_documentacion}} a su URL pública de subida.
  if (estado === "documentacion") {
    const { asegurarTokenDocumentacion, enlaceDocumentacion } = await import(
      "@/features/rrhh/lib/documentacion-candidato"
    );
    const token = await asegurarTokenDocumentacion(supabase, candidatoId, empresaId);
    if (token) vars.enlace_documentacion = enlaceDocumentacion(token);
  }

  // Fase «Formación»: resuelve {{enlace_formacion}} con la URL configurada en
  // Ajustes → RRHH → Reclutamiento. Si no hay URL, queda vacío.
  if (estado === "formacion") {
    const { data: cfgRow } = await supabase
      .from("reclutamiento_config")
      .select("formacion_url")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    vars.enlace_formacion = (cfgRow?.formacion_url as string | null) ?? "";
  }

  const subject = sustituirVariablesReclutamiento(tpl.asunto, vars);
  const bodyText = sustituirVariablesReclutamiento(tpl.cuerpo, vars);

  // Pie automático: deja claro que es un correo no monitorizado y que no admite
  // respuestas (sin incluir ninguna dirección de contacto).
  const empresaNombre = vars.empresa_nombre || "la empresa";
  const pieText =
    "Este mensaje se ha enviado de forma automática desde una dirección que no admite respuestas. Por favor, no respondas a este correo.";
  // Firma corporativa ON: cabecera (isotipo, vía sendEmail.empresaId) + pie.
  // Firma corporativa OFF: ni cabecera ni pie (correo limpio).
  const firma = cfg.emails_firma_corporativa;
  const html = firma
    ? bodyToHtml(bodyText) +
      `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:0 24px 24px"><p style="color:#9ca3af;font-size:12px;line-height:1.5;border-top:1px solid #e5e7eb;margin-top:8px;padding-top:12px">${escapeHtml(pieText)}</p></div>`
    : bodyToHtml(bodyText);

  const res = await sendEmail({
    to,
    cc,
    subject,
    html,
    text: firma ? `${bodyText}\n\n—\n${pieText}` : bodyText,
    fromName: empresaNombre,
    empresaId,
    brandHeader: firma,
  });
  if (res.ok) {
    // Marca en la actividad que este cambio de estado envió correo al candidato.
    // El registro lo creó moverCandidatoFase justo antes; actualizamos el más
    // reciente de este candidato. No afecta al resultado del envío si falla.
    const { data: ult } = await supabase
      .from("candidato_historial")
      .select("id")
      .eq("candidato_id", candidatoId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ult?.id) {
      await supabase
        .from("candidato_historial")
        // Archiva el HTML exacto enviado (res.html ya incluye la cabecera de
        // marca): así el correo recibido queda inmutable aunque cambie la plantilla.
        .update({ email_enviado: true, email_asunto: subject, email_html: res.html })
        .eq("id", ult.id as string);
    }
    return { sent: true };
  }
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

  // Duración del periodo de prueba (Ajustes → RRHH → Reclutamiento) para el
  // placeholder {{prueba_duracion_dias}} del email de inicio de Prueba.
  const { data: cfgPrueba } = await supabase
    .from("reclutamiento_config")
    .select("prueba_duracion_dias")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const pruebaDuracionDias = (cfgPrueba?.prueba_duracion_dias as number | null) ?? 30;

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
    prueba_duracion_dias: String(pruebaDuracionDias),
    ...overrides,
  };
  return vars;
}
