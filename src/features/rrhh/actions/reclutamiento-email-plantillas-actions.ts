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
  CLAVES_RESERVADAS_POR_ESTADO,
  CLAVES_ONBOARDING_PROTEGIDAS,
  NOMBRES_ONBOARDING,
  normalizarDestino,
  type DestinoPlantilla,
} from "@/features/rrhh/lib/plantillas-onboarding";

/**
 * Biblioteca de plantillas de email del RECLUTAMIENTO. Cada plantilla es SUELTA,
 * no está atada a un estado. La asociación email↔estado vive en la plantilla de
 * estados (`estados[].email_plantilla_id`) y, como override por vacante, en
 * `vacantes.email_plantillas`.
 *
 * · `clave`  — identificador ESTABLE de las plantillas del sistema (o null en las
 *   libres). El flujo las localiza por aquí, así que el NOMBRE es editable.
 * · `destino`/`destinoEmail` — a quién se envía este correo.
 */
export interface ReclutamientoEmailPlantilla {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa: boolean;
  clave: string | null;
  destino: DestinoPlantilla;
  destinoEmail: string | null;
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

/**
 * Direcciones REALES a las que se envían los correos con destinatario automático
 * (RRHH y gestoría), para la vista previa del editor de plantillas. Fuente ÚNICA:
 * Ajustes → Empresa → «Correos electrónicos» (`datos_generales.correoRrhh` /
 * `correoGestoria`). Cadena vacía si no está configurado.
 */
export async function getDestinatariosAutomaticos(): Promise<{ rrhh: string; gestoria: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { rrhh: "", gestoria: "" };

  const { data: emp } = await supabase
    .from("empresas")
    .select("email_contacto, datos_generales")
    .eq("id", empresaId)
    .maybeSingle();
  const dg = (emp?.datos_generales as Record<string, unknown> | null) ?? {};
  const dgStr = (k: string) => (typeof dg[k] === "string" ? (dg[k] as string).trim() : "");
  return {
    rrhh: dgStr("correoRrhh") || ((emp?.email_contacto as string | null)?.trim() ?? "") || dgStr("correoGeneral"),
    gestoria: dgStr("correoGestoria") || dgStr("correoGeneral"),
  };
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
    .select("id, nombre, asunto, cuerpo, activa, clave, destino, destino_email")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[reclutamiento-email-plantillas] list:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    asunto: r.asunto as string,
    cuerpo: r.cuerpo as string,
    activa: r.activa as boolean,
    clave: (r.clave as string | null) ?? null,
    destino: normalizarDestino(r.destino),
    destinoEmail: (r.destino_email as string | null) ?? null,
  }));
}

/**
 * Valida el destinatario: `personalizado` exige un email; el resto no lleva
 * `destino_email`. Devuelve el valor normalizado o un error.
 */
function normalizarDestinoInput(
  destino: DestinoPlantilla | undefined,
  destinoEmail: string | undefined,
): { destino: DestinoPlantilla; destino_email: string | null } | { error: string } {
  const d = normalizarDestino(destino);
  if (d === "personalizado") {
    const email = (destinoEmail ?? "").trim();
    if (!email) return { error: "Escribe el email del destinatario personalizado" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El email del destinatario no es válido" };
    return { destino: d, destino_email: email };
  }
  return { destino: d, destino_email: null };
}

export async function createReclutamientoEmailPlantilla(input: {
  nombre: string;
  asunto: string;
  cuerpo: string;
  activa?: boolean;
  destino?: DestinoPlantilla;
  destinoEmail?: string;
}): Promise<CreateResult> {
  const nombre = input.nombre.trim();
  const asunto = input.asunto.trim();
  const cuerpo = input.cuerpo.trim();
  if (!nombre) return { ok: false, error: "El nombre no puede estar vacío" };
  if (!asunto) return { ok: false, error: "El asunto no puede estar vacío" };
  if (!cuerpo) return { ok: false, error: "El cuerpo no puede estar vacío" };

  const dst = normalizarDestinoInput(input.destino, input.destinoEmail);
  if ("error" in dst) return { ok: false, error: dst.error };

  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const { data, error } = await supabase
    .from("reclutamiento_email_plantillas")
    .insert({
      empresa_id: empresaId,
      nombre,
      asunto,
      cuerpo,
      activa: input.activa ?? true,
      destino: dst.destino,
      destino_email: dst.destino_email,
      // Las plantillas creadas por el usuario nunca son del sistema.
      clave: null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: dupMsg(error) };

  revalidatePath("/rrhh/reclutamiento");
  return { ok: true, id: data.id as string };
}

export async function updateReclutamientoEmailPlantilla(
  id: string,
  patch: {
    nombre?: string;
    asunto?: string;
    cuerpo?: string;
    activa?: boolean;
    destino?: DestinoPlantilla;
    destinoEmail?: string;
  },
): Promise<ActionResult> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // El nombre YA es editable (el flujo localiza las del sistema por `clave`, no
  // por el nombre): renombrar aquí se propaga solo a todo el flujo.
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
  if (patch.destino !== undefined) {
    const dst = normalizarDestinoInput(patch.destino, patch.destinoEmail);
    if ("error" in dst) return { ok: false, error: dst.error };
    update.destino = dst.destino;
    update.destino_email = dst.destino_email;
  }

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
  // se pueden borrar: las dispara el sistema. Se identifican por su CLAVE estable
  // (no por el nombre, que ahora es editable). Defensa en servidor además de la UI.
  const { data: actual } = await supabase
    .from("reclutamiento_email_plantillas")
    .select("clave")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (actual?.clave && CLAVES_ONBOARDING_PROTEGIDAS.has(actual.clave as string)) {
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
    .select("nombre, asunto, cuerpo, activa, destino, destino_email")
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

  // La copia es SIEMPRE una plantilla libre (clave null en createReclutamiento…),
  // pero hereda el destinatario configurado.
  return createReclutamientoEmailPlantilla({
    nombre,
    asunto: orig.asunto as string,
    cuerpo: orig.cuerpo as string,
    activa: orig.activa as boolean,
    destino: normalizarDestino(orig.destino),
    destinoEmail: (orig.destino_email as string | null) ?? undefined,
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
): Promise<{
  id: string;
  asunto: string;
  cuerpo: string;
  activa: boolean;
  destino: DestinoPlantilla;
  destinoEmail: string | null;
} | null> {
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
    .select("id, asunto, cuerpo, activa, destino, destino_email")
    .eq("id", emailId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!tpl) return null;
  return {
    id: tpl.id as string,
    asunto: tpl.asunto as string,
    cuerpo: tpl.cuerpo as string,
    activa: tpl.activa as boolean,
    destino: normalizarDestino(tpl.destino),
    destinoEmail: (tpl.destino_email as string | null) ?? null,
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
    const { enlaceDocumentacion, DOCUMENTACION_TOKEN_DIAS } = await import(
      "@/features/rrhh/lib/documentacion-candidato"
    );
    vars.documentacion_dias_validez = String(DOCUMENTACION_TOKEN_DIAS);
    if (token) {
      vars.enlace_documentacion = enlaceDocumentacion(token);
    } else {
      vars.enlace_documentacion = "(se generará un enlace personal al enviar)";
    }
  }

  // Fase «Formación»: resuelve {{enlace_formacion}} igual que el envío pero SIN
  // efectos (persistir=false: no genera token nuevo). Si aún no hay token, deja
  // un texto-placeholder legible.
  if (estado === "formacion") {
    const enlace = await resolverEnlaceFormacion(
      supabase,
      empresaId,
      candidatoId,
      false,
    );
    vars.enlace_formacion =
      enlace || "(configura la URL de formación en Ajustes → RRHH → Reclutamiento)";
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

  // 2) Claves reservadas del onboarding a buscar por `clave` estable.
  const clavesReservadas = [
    ...new Set(Object.values(CLAVES_RESERVADAS_POR_ESTADO).flat()),
  ];

  // Carga en bloque todas las plantillas implicadas (por id y por clave).
  const ids = [...new Set(Object.values(idPorEstado))];
  const { data: porId } = ids.length
    ? await supabase
        .from("reclutamiento_email_plantillas")
        .select("id, nombre, activa, destino")
        .eq("empresa_id", empresaId)
        .in("id", ids)
    : { data: [] as Array<{ id: string; nombre: string; activa: boolean; destino: string }> };
  const { data: porClave } = clavesReservadas.length
    ? await supabase
        .from("reclutamiento_email_plantillas")
        .select("clave, nombre, activa, destino")
        .eq("empresa_id", empresaId)
        .in("clave", clavesReservadas)
    : { data: [] as Array<{ clave: string; nombre: string; activa: boolean; destino: string }> };

  const tplById = new Map(
    (porId ?? []).map((t) => [
      t.id as string,
      { nombre: t.nombre as string, activa: !!t.activa, destino: normalizarDestino(t.destino) },
    ]),
  );
  const tplByClave = new Map(
    (porClave ?? []).map((t) => [
      t.clave as string,
      { nombre: t.nombre as string, activa: !!t.activa, destino: normalizarDestino(t.destino) },
    ]),
  );

  // 2a) Plantilla de estado → su destinatario configurado.
  for (const [estado, id] of Object.entries(idPorEstado)) {
    const t = tplById.get(id);
    if (t) push(estado, { nombre: t.nombre, activa: t.activa, destino: t.destino });
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

  // 2b) Plantillas reservadas del sistema por fase fija (por clave estable).
  for (const [estado, claves] of Object.entries(CLAVES_RESERVADAS_POR_ESTADO)) {
    for (const clave of claves) {
      const t = tplByClave.get(clave);
      const nombre = t?.nombre ?? NOMBRES_ONBOARDING[clave];
      // No duplicar si la plantilla de estado ya apuntaba al mismo nombre.
      if ((out[estado] ?? []).some((p) => p.nombre === nombre)) continue;
      push(estado, {
        nombre,
        activa: t ? t.activa : true,
        destino: t?.destino ?? "candidato",
      });
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

  // Destinatario configurado en la plantilla (por defecto, el candidato).
  const { data: cand } = await supabase
    .from("candidatos")
    .select("email")
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const emailCandidato = (cand?.email as string | null) ?? "";
  const { resolverDestinatario } = await import(
    "@/features/rrhh/services/email-plantillas/resolver"
  );
  const admin = (await import("@/lib/supabase/admin")).createAdminClient();
  const dst = await resolverDestinatario(admin, empresaId, tpl.destino, tpl.destinoEmail, emailCandidato);
  const to = dst.to;
  if (!to) {
    return {
      sent: false,
      reason:
        tpl.destino === "candidato"
          ? "El candidato no tiene email"
          : "El destinatario configurado en la plantilla no tiene email",
    };
  }

  const vars = await buildReclutamientoEmailVars(candidatoId);

  // Paso «Documentación»: genera (perezosamente) el token del candidato y resuelve
  // el placeholder {{enlace_documentacion}} a su URL pública de subida.
  if (estado === "documentacion") {
    const { asegurarTokenDocumentacion, enlaceDocumentacion, DOCUMENTACION_TOKEN_DIAS } =
      await import("@/features/rrhh/lib/documentacion-candidato");
    const token = await asegurarTokenDocumentacion(supabase, candidatoId, empresaId);
    if (token) vars.enlace_documentacion = enlaceDocumentacion(token);
    vars.documentacion_dias_validez = String(DOCUMENTACION_TOKEN_DIAS);
  }

  // Fase «Formación»: resuelve {{enlace_formacion}} al enlace PÚBLICO por token
  // del candidato (/formacion/<token>), que muestra el curso del puesto de su
  // vacante sin login. persistir=true genera/renueva el token al enviar.
  if (estado === "formacion") {
    vars.enlace_formacion = await resolverEnlaceFormacion(
      supabase,
      empresaId,
      candidatoId,
      true,
    );
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

  // CC: copia al reclutador (config) + cc del destinatario (p. ej. gestoría).
  const ccFinal = [cc, dst.cc].filter(Boolean).join(", ") || undefined;

  const res = await sendEmail({
    to,
    cc: ccFinal,
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
 * Resuelve {{enlace_formacion}} para un candidato concreto.
 *
 * En la fase «Formación» el candidato AÚN NO tiene cuenta (el usuario se crea al
 * entrar en «Contratación»), así que el enlace es PÚBLICO por token:
 * `/formacion/<token>`. Esa página resuelve el curso del puesto de su vacante
 * (candidato → vacante → puesto → curso; 1 puesto = 1 curso) y lo muestra sin
 * login. El token se guarda en `candidatos.formacion_token`.
 *
 * `persistir` = true (envío real) genera/renueva el token con caducidad +7 días.
 * `persistir` = false (previa) solo lee el token existente para no tener efectos.
 *
 * Si el candidato no tiene vacante/puesto/curso, cae a la URL genérica de
 * Ajustes → RRHH → Reclutamiento (`reclutamiento_config.formacion_url`).
 */
async function resolverEnlaceFormacion(
  supabase: Awaited<ReturnType<typeof ctx>>["supabase"],
  empresaId: string,
  candidatoId: string,
  persistir: boolean,
): Promise<string> {
  const { enlaceFormacionPublica, asegurarTokenFormacion } = await import(
    "@/features/rrhh/lib/documentacion-candidato"
  );

  // candidato → vacante → puesto. Solo si tiene puesto tiene sentido el enlace
  // público (que resuelve el curso de ese puesto).
  const { data: cand } = await supabase
    .from("candidatos")
    .select("vacante_id, formacion_token")
    .eq("id", candidatoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const vacanteId = (cand?.vacante_id as string | null) ?? null;

  let puestoId: string | null = null;
  if (vacanteId) {
    const { data: vac } = await supabase
      .from("vacantes")
      .select("puesto_id")
      .eq("id", vacanteId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    puestoId = (vac?.puesto_id as string | null) ?? null;
  }

  if (puestoId) {
    let token = (cand?.formacion_token as string | null) ?? null;
    if (persistir) {
      // Solo el envío real tiene efectos: garantiza que el curso del puesto
      // exista (para que la página no muestre "en preparación") y genera/renueva
      // el token del enlace público. La previa no crea nada.
      const { getCursoDePuesto } = await import(
        "@/features/formacion/actions/formacion-actions"
      );
      await getCursoDePuesto(puestoId);
      token = await asegurarTokenFormacion(supabase, candidatoId, empresaId);
    }
    if (token) return enlaceFormacionPublica(token);
    // Sin token todavía (previa antes del primer envío): texto-placeholder.
    if (!persistir) return "(se generará un enlace personal al enviar)";
  }

  // Fallback: URL genérica de formación configurada por empresa.
  const { data: cfgRow } = await supabase
    .from("reclutamiento_config")
    .select("formacion_url")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return (cfgRow?.formacion_url as string | null) || "";
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
    // Correo de RRHH (Ajustes → RRHH → Reclutamiento). `email_rrhh` es el código
    // recomendado; `empresa_email` es un alias antiguo con el MISMO valor.
    email_rrhh:
      dgStr("correoRrhh") ||
      ((emp?.email_contacto as string | null) ?? "") ||
      dgStr("correoGeneral"),
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
