"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type TareaPrioridad = "alta" | "media" | "baja";
export type TareaTipo = "manual" | "nueva_receta_fase" | "sistema";

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

/**
 * Lista tareas del usuario actual.
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
    return { ok: true, data: (data as TareaRow[]) ?? [] };
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

export async function toggleTareaHecha(id: string): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { data: cur } = await supabase
      .from("tareas")
      .select("hecha")
      .eq("id", id)
      .single();
    const { error } = await supabase
      .from("tareas")
      .update({ hecha: !cur?.hecha })
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Cuenta las tareas pendientes del usuario actual para hoy.
 * Usada por useDailyCounts en el header.
 */
export async function contarPendientesHoy(): Promise<Result<number>> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: true, data: 0 };
    const hoy = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from("tareas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("fecha", hoy)
      .eq("hecha", false);
    if (error) throw error;
    return { ok: true, data: count ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteTarea(id: string): Promise<Result> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
