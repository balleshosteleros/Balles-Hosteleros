"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { getMiInformacionLaboral } from "@/features/rrhh/actions/empleados-actions";

export type TareaPrioridad = "alta" | "media" | "baja";
export type TareaTipo = "manual" | "nueva_receta_fase" | "sistema" | "cronograma";

export interface TareaRow {
  id: string;
  empresa_id: string | null;
  user_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hecha: boolean;
  prioridad: TareaPrioridad;
  tipo: TareaTipo;
  link_url: string | null;
  ref_tabla: string | null;
  ref_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const TIPO_ORDER: Record<TareaTipo, number> = {
  cronograma: 0,
  nueva_receta_fase: 1,
  manual: 2,
  sistema: 3,
};

function sortTareas(rows: TareaRow[]): TareaRow[] {
  return rows.slice().sort((a, b) => {
    const fa = a.fecha;
    const fb = b.fecha;
    if (fa !== fb) return fa < fb ? -1 : 1;
    const ta = TIPO_ORDER[a.tipo] ?? 99;
    const tb = TIPO_ORDER[b.tipo] ?? 99;
    if (ta !== tb) return ta - tb;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
}

/**
 * Lista tareas del usuario actual. Las tareas tipo "cronograma" salen primero
 * dentro de cada día.
 */
export async function listTareasMias(): Promise<Result<TareaRow[]>> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("tareas")
      .select("*")
      .eq("user_id", userId)
      .order("fecha", { ascending: true });
    if (error) throw error;
    return { ok: true, data: sortTareas((data as TareaRow[]) ?? []) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Crea una tarea manual para el usuario actual.
 */
export async function crearTareaManual(input: {
  titulo: string;
  fecha: string;
  prioridad: TareaPrioridad;
}): Promise<Result<TareaRow>> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        empresa_id: empresaId,
        user_id: userId,
        titulo: input.titulo,
        fecha: input.fecha,
        prioridad: input.prioridad,
        tipo: "manual",
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as TareaRow };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Crea una tarea asignada a otro usuario (ej: al mover fase de receta).
 */
export async function crearTareaAsignada(input: {
  user_id: string;
  empresa_id: string;
  titulo: string;
  descripcion?: string | null;
  tipo?: TareaTipo;
  prioridad?: TareaPrioridad;
  link_url?: string;
  ref_tabla?: string;
  ref_id?: string;
}): Promise<Result<TareaRow>> {
  try {
    const { supabase, userId } = await getAppContext();
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        empresa_id: input.empresa_id,
        user_id: input.user_id,
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        fecha: new Date().toISOString().slice(0, 10),
        prioridad: input.prioridad ?? "media",
        tipo: input.tipo ?? "manual",
        link_url: input.link_url ?? null,
        ref_tabla: input.ref_tabla ?? null,
        ref_id: input.ref_id ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as TareaRow };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function marcarTarea(id: string, hecha: boolean): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("tareas")
      .update({ hecha, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "No se pudo actualizar la tarea" };
  }
}

/** Alias para compatibilidad — toglea el campo hecha de la tarea */
export async function toggleTareaHecha(id: string): Promise<Result> {
  const { supabase } = await getAppContext();
  const { data: current } = await supabase
    .from("tareas")
    .select("hecha")
    .eq("id", id)
    .single();
  return marcarTarea(id, !current?.hecha);
}

/** Elimina una tarea */
export async function deleteTarea(id: string): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al eliminar" };
  }
}

/** Cuenta tareas pendientes de hoy para el badge del header */
export async function contarPendientesHoy(): Promise<{ ok: boolean; data: number }> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: true, data: 0 };
    const hoy = new Date().toISOString().split("T")[0];
    const { count, error } = await supabase
      .from("tareas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("fecha", hoy)
      .eq("hecha", false);
    if (error) throw error;
    return { ok: true, data: count ?? 0 };
  } catch {
    return { ok: true, data: 0 };
  }
}

export async function listTareasSugeridas() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };

    const infoLaboral = await getMiInformacionLaboral();
    if (!infoLaboral.ok || !infoLaboral.data) {
      return { ok: true, data: [] };
    }

    const info = infoLaboral.data as any;
    const rolesToMatch = [];
    if (info.departamentos?.nombre) rolesToMatch.push(info.departamentos.nombre.toUpperCase());
    if (info.puestos_trabajo?.nombre) rolesToMatch.push(info.puestos_trabajo.nombre.toUpperCase());

    if (rolesToMatch.length === 0) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("cronogramas_operativos")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("rol", rolesToMatch);

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[tareas] listTareasSugeridas:", err);
    return { ok: false, data: [] };
  }
}

export async function completarTareaSugerida(cronogramaId: string, titulo: string) {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, error: "No autenticado" };

    const hoy = new Date().toISOString().split("T")[0];
    const { data: existente } = await supabase
      .from("tareas")
      .select("id")
      .eq("user_id", userId)
      .eq("ref_tabla", "cronogramas_operativos")
      .eq("ref_id", cronogramaId)
      .eq("fecha", hoy)
      .maybeSingle();

    if (existente) return { ok: true };

    const { error } = await supabase.from("tareas").insert({
      empresa_id: empresaId,
      user_id: userId,
      titulo: titulo,
      fecha: hoy,
      hecha: true,
      prioridad: "media",
      tipo: "sistema",
      ref_tabla: "cronogramas_operativos",
      ref_id: cronogramaId
    });

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[tareas] completarTareaSugerida:", err);
    return { ok: false, error: "Error al marcar tarea" };
  }
}

/* ───────────── Cronogramas → Mis Tareas (auto-seed) ───────────── */

interface CronogramaTareaRow {
  id: string;
  rol: string;
  tarea: string;
  resumen: string | null;
  frecuencia: string | null;
  tiempo_requerido: string | null;
  dia_semana: number[] | null;
  dia_mes: number | null;
  fecha_anual: string | null;
  meses_trimestrales: number[] | null;
  empleados_asignados: string[] | null;
  parent_id: string | null;
  empresa_id: string | null;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekday(d: Date): number {
  // ISO: 1=lunes ... 7=domingo
  const js = d.getDay(); // 0=domingo
  return js === 0 ? 7 : js;
}

function tocaHoy(t: CronogramaTareaRow, hoy: Date): boolean {
  const f = (t.frecuencia ?? "").toUpperCase();
  if (!f) return false;
  if (f === "DIARIO") return true;
  if (f === "SEMANAL") {
    const arr = t.dia_semana ?? [];
    return arr.includes(isoWeekday(hoy));
  }
  if (f === "MENSUAL") {
    return t.dia_mes === hoy.getDate();
  }
  if (f === "TRIMESTRAL") {
    const meses = t.meses_trimestrales ?? [];
    return meses.includes(hoy.getMonth() + 1) && t.dia_mes === hoy.getDate();
  }
  if (f === "ANUAL") {
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    return t.fecha_anual === `${mm}-${dd}`;
  }
  // POR NECESIDAD / OTRO → no se materializa
  return false;
}

interface SeedSummary {
  rol: string | null;
  insertadas: number;
  yaExistian: number;
}

/**
 * Materializa en `tareas` las tareas del cronograma del rol del usuario que
 * tocan hoy. Idempotente: chequea existentes antes de insertar.
 *
 * Empareja `cronogramas_operativos.rol` con `profiles.rol_label`
 * (case-insensitive, trim).
 */
export async function seedTareasCronogramaHoy(): Promise<Result<SeedSummary>> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: true, data: { rol: null, insertadas: 0, yaExistian: 0 } };

    // 1) Rol del usuario
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("rol_label")
      .eq("user_id", userId)
      .single();
    if (pErr) {
      console.warn("[seedTareasCronogramaHoy] sin profile:", pErr.message);
      return { ok: true, data: { rol: null, insertadas: 0, yaExistian: 0 } };
    }
    const rolRaw = (profile?.rol_label as string | null) ?? null;
    const rol = rolRaw ? rolRaw.trim() : null;
    if (!rol) {
      return { ok: true, data: { rol: null, insertadas: 0, yaExistian: 0 } };
    }

    // 2) Cronogramas del rol (ilike sin wildcards = igualdad case-insensitive)
    const { data: cronos, error: cErr } = await supabase
      .from("cronogramas_operativos")
      .select(
        "id, rol, tarea, resumen, frecuencia, tiempo_requerido, dia_semana, dia_mes, fecha_anual, meses_trimestrales, empleados_asignados, parent_id, empresa_id"
      )
      .ilike("rol", rol);
    if (cErr) throw cErr;

    const candidatos = (cronos as CronogramaTareaRow[] | null) ?? [];
    const hoy = new Date();
    const hoyIso = ymd(hoy);

    // Filtrar: que toquen hoy y que el usuario esté asignado (o asignación abierta)
    const aSembrar = candidatos.filter((t) => {
      if (!tocaHoy(t, hoy)) return false;
      const asig = t.empleados_asignados;
      if (!asig || asig.length === 0) return true; // abierto a todo el rol
      return asig.includes(userId);
    });

    if (aSembrar.length === 0) {
      return { ok: true, data: { rol, insertadas: 0, yaExistian: 0 } };
    }

    // 3) ¿Cuáles ya existen hoy?
    const { data: existentes, error: eErr } = await supabase
      .from("tareas")
      .select("ref_id")
      .eq("user_id", userId)
      .eq("fecha", hoyIso)
      .eq("ref_tabla", "cronogramas_operativos")
      .in(
        "ref_id",
        aSembrar.map((t) => t.id)
      );
    if (eErr) throw eErr;
    const existSet = new Set(
      ((existentes as { ref_id: string }[] | null) ?? []).map((r) => r.ref_id)
    );

    const nuevas = aSembrar.filter((t) => !existSet.has(t.id));

    if (nuevas.length === 0) {
      return { ok: true, data: { rol, insertadas: 0, yaExistian: existSet.size } };
    }

    // 4) Insertar
    const rows = nuevas.map((t) => ({
      empresa_id: empresaId ?? t.empresa_id ?? null,
      user_id: userId,
      titulo: t.tarea,
      descripcion: t.resumen ?? null,
      fecha: hoyIso,
      hecha: false,
      prioridad: "alta" as TareaPrioridad,
      tipo: "cronograma" as TareaTipo,
      link_url: null,
      ref_tabla: "cronogramas_operativos",
      ref_id: t.id,
      created_by: userId,
    }));

    const { error: iErr } = await supabase.from("tareas").insert(rows);
    if (iErr) throw iErr;

    return {
      ok: true,
      data: { rol, insertadas: rows.length, yaExistian: existSet.size },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[seedTareasCronogramaHoy]", msg);
    return { ok: false, error: msg };
  }
}
