"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export async function listElaboraciones() {
  try {
    const { supabase, empresaId } = await getAppContext();
    const query = supabase
      .from("elaboraciones")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[elaboraciones] listElaboraciones:", err);
    return { ok: false, data: [] };
  }
}

export async function createElaboracion(input: {
  nombre: string;
  tipo?: string;
  descripcion?: string;
  tiempo_estimado?: number;
  responsable?: string;
}) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("elaboraciones")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        categoria: input.tipo ?? null,          // tipo → categoria
        descripcion: input.descripcion ?? null,
        tiempo: input.tiempo_estimado ? String(input.tiempo_estimado) + " min" : null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] createElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateElaboracion(
  id: string,
  input: {
    nombre?: string;
    tipo?: string;
    descripcion?: string;
    tiempo_estimado?: number;
    responsable?: string;
    estado?: string;
  }
) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.nombre !== undefined) payload.nombre = input.nombre;
    if (input.tipo !== undefined) payload.categoria = input.tipo;
    if (input.descripcion !== undefined) payload.descripcion = input.descripcion;
    if (input.tiempo_estimado !== undefined) payload.tiempo = String(input.tiempo_estimado) + " min";
    if (input.estado !== undefined) payload.estado = input.estado;

    const { error } = await supabase
      .from("elaboraciones")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] updateElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteElaboracion(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("elaboraciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] deleteElaboracion:", msg);
    return { ok: false, error: msg };
  }
}
