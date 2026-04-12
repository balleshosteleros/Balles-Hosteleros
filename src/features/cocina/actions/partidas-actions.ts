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

export async function listPartidas() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("partidas")
      .select("*")
      .order("orden", { ascending: true });
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
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("partidas")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        orden: input.orden ?? 0,
        responsable: input.responsable ?? null,
        created_by: user?.id ?? null,
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
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("partidas")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[partidas] updatePartida:", msg);
    return { ok: false, error: msg };
  }
}
