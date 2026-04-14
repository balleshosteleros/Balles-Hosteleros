"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export async function listPartidas() {
  try {
    const { supabase, empresaId } = await getAppContext();
    const query = supabase
      .from("partidas")
      .select("*")
      .order("nombre", { ascending: true });   // tabla no tiene columna 'orden'
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[partidas] listPartidas:", err);
    return { ok: false, data: [] };
  }
}

export async function createPartida(input: {
  nombre: string;
  orden?: number;
  responsable?: string;
}) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("partidas")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        responsable: input.responsable ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[partidas] createPartida:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePartida(
  id: string,
  input: { nombre?: string; orden?: number; responsable?: string }
) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = {};
    if (input.nombre !== undefined) payload.nombre = input.nombre;
    if (input.responsable !== undefined) payload.responsable = input.responsable;

    const { error } = await supabase
      .from("partidas")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[partidas] updatePartida:", msg);
    return { ok: false, error: msg };
  }
}
