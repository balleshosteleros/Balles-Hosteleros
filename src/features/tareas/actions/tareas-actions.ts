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


