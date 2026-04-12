"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listStock() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("stock")
      .select("*")
      .order("producto_nombre", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[stock] listStock:", err);
    return { ok: false, data: [] };
  }
}

export async function updateStock(
  id: string,
  input: { cantidad?: number; cantidad_minima?: number; notas?: string }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("stock")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] updateStock:", msg);
    return { ok: false, error: msg };
  }
}
