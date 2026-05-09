"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export async function listEscandallos() {
  try {
    const { supabase, empresaId } = await getAppContext();
    const query = supabase
      .from("producto_composicion")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[escandallos] listEscandallos:", err);
    return { ok: false, data: [] };
  }
}

export async function createEscandallo(input: {
  nombre: string;
  categoria?: string;
  raciones?: number;
  tiempo_elaboracion?: number;
  notas?: string;
  ingredientes?: { producto_nombre: string; cantidad: number; unidad?: string; coste?: number }[];
}) {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: escandallo, error: fichaErr } = await supabase
      .from("producto_composicion")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        categoria: input.categoria ?? null,
        porciones: input.raciones ?? null,
        tiempo_preparacion: input.tiempo_elaboracion ? String(input.tiempo_elaboracion) + " min" : null,
        notas: input.notas ?? null,
      })
      .select()
      .single();
    if (fichaErr) throw fichaErr;

    if (input.ingredientes && input.ingredientes.length > 0) {
      const rows = input.ingredientes.map((ing) => ({
        escandallo_id: escandallo.id,
        nombre: ing.producto_nombre,
        cantidad: ing.cantidad,
        unidad: ing.unidad ?? "kg",
        coste_unitario: ing.coste ?? 0,
        coste_total: (ing.coste ?? 0) * ing.cantidad,
      }));
      const { error: ingErr } = await supabase
        .from("escandallo_ingredientes")
        .insert(rows);
      if (ingErr) throw ingErr;
    }

    return { ok: true, data: escandallo };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] createEscandallo:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateEscandallo(
  id: string,
  input: {
    nombre?: string;
    categoria?: string;
    raciones?: number;
    tiempo_elaboracion?: number;
    notas?: string;
  }
) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.nombre !== undefined) payload.nombre = input.nombre;
    if (input.categoria !== undefined) payload.categoria = input.categoria;
    if (input.raciones !== undefined) payload.porciones = input.raciones;
    if (input.tiempo_elaboracion !== undefined) payload.tiempo_preparacion = String(input.tiempo_elaboracion) + " min";
    if (input.notas !== undefined) payload.notas = input.notas;

    const { error } = await supabase
      .from("producto_composicion")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] updateEscandallo:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEscandallo(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("producto_composicion")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos] deleteEscandallo:", msg);
    return { ok: false, error: msg };
  }
}
