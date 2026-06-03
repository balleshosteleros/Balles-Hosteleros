"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type {
  PlantillaBoarding,
  ProcesoBoarding,
  TareaPlantilla,
  TareaProceso,
  TipoBoarding,
  EstadoProceso,
} from "@/features/rrhh/data/boarding";

// ── Contexto ────────────────────────────────────────────────────
// Preferimos el UUID explícito del cliente (empresaActual.dbId) para evitar la
// carrera con la cookie de empresa activa al cambiar de empresa (mismo patrón
// que getEmpleadosActivos de OLA2-01). RLS protege en ambos casos: un dbId
// fuera de las empresas del usuario devuelve [] / { ok:false } en escritura.
async function getContext(empresaDbId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = empresaDbId ?? (await getEmpresaActivaForUser(supabase, user.id));
  return { supabase, user, empresaId };
}

// ── Mapeo BD (snake_case / JSONB) → TS anidado ──────────────────
// El JSONB persiste { titulo, orden } (plantilla) y { titulo, completada,
// orden, fechaCompletado } (proceso). El id de tarea TS no se persiste: se
// deriva de forma estable a partir de `orden` para que toggleTarea tenga una
// clave fiable que sobreviva al round-trip.
type TareaPlantillaJson = { titulo?: string; orden?: number };
type TareaProcesoJson = {
  titulo?: string;
  completada?: boolean;
  orden?: number;
  fechaCompletado?: string | null;
};

function mapTareaPlantilla(t: TareaPlantillaJson, i: number): TareaPlantilla {
  const orden = typeof t.orden === "number" ? t.orden : i + 1;
  return { id: `t${orden}`, nombre: t.titulo ?? "", orden };
}

function mapTareaProceso(t: TareaProcesoJson, i: number): TareaProceso {
  const orden = typeof t.orden === "number" ? t.orden : i + 1;
  return {
    id: `t${orden}`,
    nombre: t.titulo ?? "",
    completada: Boolean(t.completada),
    fechaCompletado: t.fechaCompletado ?? null,
    orden,
  };
}

function mapPlantilla(row: Record<string, unknown>): PlantillaBoarding {
  const tareas = Array.isArray(row.tareas) ? (row.tareas as TareaPlantillaJson[]) : [];
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? "",
    tipo: ((row.tipo as string) ?? "onboarding") as TipoBoarding,
    empresaId: (row.empresa_id as string) ?? "",
    tareas: tareas.map(mapTareaPlantilla).sort((a, b) => a.orden - b.orden),
  };
}

function mapProceso(row: Record<string, unknown>): ProcesoBoarding {
  const tareas = Array.isArray(row.tareas) ? (row.tareas as TareaProcesoJson[]) : [];
  return {
    id: row.id as string,
    empleadoId: (row.empleado_id as string) ?? "",
    tipo: ((row.tipo as string) ?? "onboarding") as TipoBoarding,
    estado: ((row.estado as string) ?? "activo") as EstadoProceso,
    plantillaId: (row.plantilla_id as string | null) ?? "",
    plantillaNombre: (row.plantilla_nombre as string | null) ?? "",
    fechaInicio: (row.fecha_inicio as string) ?? "",
    empresaId: (row.empresa_id as string) ?? "",
    tareas: tareas.map(mapTareaProceso).sort((a, b) => a.orden - b.orden),
  };
}

const hoy = () => new Date().toISOString().slice(0, 10);

/* ---------- Plantillas ---------- */

export async function listPlantillas(
  empresaDbId?: string,
): Promise<{ ok: true; data: PlantillaBoarding[] } | { ok: false; data: [] }> {
  try {
    const { supabase, empresaId } = await getContext(empresaDbId);
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("plantillas_boarding")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapPlantilla) };
  } catch (err) {
    console.error("[boarding] listPlantillas:", err);
    return { ok: false, data: [] };
  }
}

export async function createPlantilla(input: {
  nombre: string;
  tipo: TipoBoarding;
  tareas: { titulo: string; orden: number }[];
}): Promise<{ ok: true; data: PlantillaBoarding } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("plantillas_boarding")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        tipo: input.tipo,
        tareas: input.tareas.map((t) => ({ titulo: t.titulo, orden: t.orden })),
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: mapPlantilla(data as Record<string, unknown>) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] createPlantilla:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePlantilla(input: {
  id: string;
  nombre: string;
  tipo: TipoBoarding;
  tareas: { titulo: string; orden: number }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("plantillas_boarding")
      .update({
        nombre: input.nombre,
        tipo: input.tipo,
        tareas: input.tareas.map((t) => ({ titulo: t.titulo, orden: t.orden })),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] updatePlantilla:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePlantilla(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("plantillas_boarding").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] deletePlantilla:", msg);
    return { ok: false, error: msg };
  }
}

/* ---------- Procesos ---------- */

export async function listProcesos(
  empresaDbId?: string,
): Promise<{ ok: true; data: ProcesoBoarding[] } | { ok: false; data: [] }> {
  try {
    const { supabase, empresaId } = await getContext(empresaDbId);
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("procesos_boarding")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapProceso) };
  } catch (err) {
    console.error("[boarding] listProcesos:", err);
    return { ok: false, data: [] };
  }
}

export async function createProceso(input: {
  empleadoId: string; // = empleados.id (uuid real, vía selector OLA2-01)
  plantillaId: string;
  plantillaNombre: string;
  tipo: TipoBoarding;
  fechaInicio: string; // YYYY-MM-DD
  tareas: { titulo: string; completada: boolean; orden: number }[];
}): Promise<{ ok: true; data: ProcesoBoarding } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("procesos_boarding")
      .insert({
        empresa_id: empresaId,
        empleado_id: input.empleadoId,
        plantilla_id: input.plantillaId || null,
        plantilla_nombre: input.plantillaNombre,
        tipo: input.tipo,
        estado: "activo",
        fecha_inicio: input.fechaInicio,
        tareas: input.tareas.map((t) => ({
          titulo: t.titulo,
          completada: t.completada,
          orden: t.orden,
          fechaCompletado: null,
        })),
        iniciado_por: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: mapProceso(data as Record<string, unknown>) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] createProceso:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateProcesoTareas(
  id: string, // uuid de procesos_boarding (no id mock)
  tareas: {
    titulo: string;
    completada: boolean;
    orden: number;
    fechaCompletado: string | null;
  }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("procesos_boarding")
      .update({
        tareas: tareas.map((t) => ({
          titulo: t.titulo,
          completada: t.completada,
          orden: t.orden,
          fechaCompletado: t.fechaCompletado,
        })),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] updateProcesoTareas:", msg);
    return { ok: false, error: msg };
  }
}

// Finalizar / archivar / reactivar de forma persistente. Vocabulario canónico
// único (CHECK en BD: activo | finalizado | archivado). fecha_fin marca el
// cierre (se limpia al reactivar).
export async function setEstadoProceso(
  id: string,
  estado: EstadoProceso,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("procesos_boarding")
      .update({
        estado,
        fecha_fin: estado === "activo" ? null : hoy(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] setEstadoProceso:", msg);
    return { ok: false, error: msg };
  }
}

export async function duplicarProceso(
  id: string,
): Promise<{ ok: true; data: ProcesoBoarding } | { ok: false; error: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data: orig, error: readErr } = await supabase
      .from("procesos_boarding")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();
    if (readErr) throw readErr;
    const origTareas = Array.isArray(orig.tareas) ? (orig.tareas as TareaProcesoJson[]) : [];
    const { data, error } = await supabase
      .from("procesos_boarding")
      .insert({
        empresa_id: empresaId,
        empleado_id: orig.empleado_id,
        plantilla_id: orig.plantilla_id,
        plantilla_nombre: orig.plantilla_nombre,
        tipo: orig.tipo,
        estado: "activo",
        fecha_inicio: hoy(),
        tareas: origTareas.map((t) => ({
          titulo: t.titulo ?? "",
          completada: false,
          orden: t.orden ?? 0,
          fechaCompletado: null,
        })),
        iniciado_por: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: mapProceso(data as Record<string, unknown>) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] duplicarProceso:", msg);
    return { ok: false, error: msg };
  }
}
