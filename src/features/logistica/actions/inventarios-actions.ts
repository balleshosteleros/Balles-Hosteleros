"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listInventarios() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("inventarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[inventarios] listInventarios:", err);
    return { ok: false, data: [] };
  }
}

export async function createInventario(input: {
  nombre: string;
  tipo?: string;
  notas?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("inventarios")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        tipo: input.tipo ?? null,
        notas: input.notas ?? null,
        estado: "borrador",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] createInventario:", msg);
    return { ok: false, error: msg };
  }
}

export async function getInventario(id: string) {
  try {
    const { supabase } = await getContext();
    const { data: inventario, error: invErr } = await supabase
      .from("inventarios")
      .select("*")
      .eq("id", id)
      .single();
    if (invErr) throw invErr;

    const { data: lineas, error: linErr } = await supabase
      .from("lineas_inventario")
      .select("*")
      .eq("inventario_id", id)
      .order("producto_nombre", { ascending: true });
    if (linErr) throw linErr;

    return { ok: true, data: { ...inventario, lineas: lineas ?? [] } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] getInventario:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateInventarioEstado(id: string, estado: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("inventarios")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[inventarios] updateInventarioEstado:", msg);
    return { ok: false, error: msg };
  }
}
