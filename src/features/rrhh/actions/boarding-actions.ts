"use server";

import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: data?.empresa_id ?? null };
}

/* ---------- Plantillas ---------- */

export async function listPlantillas() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("plantillas_boarding")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[boarding] listPlantillas:", err);
    return { ok: false, data: [] };
  }
}

export async function createPlantilla(input: {
  nombre: string;
  tipo: string;
  tareas: { titulo: string; descripcion?: string; orden: number }[];
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("plantillas_boarding")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        tipo: input.tipo,
        tareas: input.tareas,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] createPlantilla:", msg);
    return { ok: false, error: msg };
  }
}

/* ---------- Procesos ---------- */

export async function listProcesos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("procesos_boarding")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[boarding] listProcesos:", err);
    return { ok: false, data: [] };
  }
}

export async function createProceso(input: {
  empleado_nombre: string;
  empleado_id?: string;
  plantilla_id?: string;
  tipo: string;
  fecha_inicio: string;
  tareas: { titulo: string; completada: boolean }[];
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("procesos_boarding")
      .insert({
        empresa_id: empresaId,
        empleado_nombre: input.empleado_nombre,
        empleado_id: input.empleado_id ?? null,
        plantilla_id: input.plantilla_id ?? null,
        tipo: input.tipo,
        fecha_inicio: input.fecha_inicio,
        tareas: input.tareas,
        estado: "en_progreso",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[boarding] createProceso:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateProcesoTareas(
  id: string,
  tareas: { titulo: string; completada: boolean }[]
) {
  try {
    const { supabase } = await getContext();
    const allDone = tareas.every((t) => t.completada);
    const { error } = await supabase
      .from("procesos_boarding")
      .update({
        tareas,
        estado: allDone ? "completado" : "en_progreso",
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
