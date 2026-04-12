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
