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

export async function listEncuestas() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("encuestas")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[encuestas] listEncuestas:", err);
    return { ok: false, data: [] };
  }
}

export async function createEncuesta(input: {
  titulo: string;
  descripcion?: string;
  preguntas?: unknown[];
  fecha_inicio?: string;
  fecha_fin?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("encuestas")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo,
        descripcion: input.descripcion ?? null,
        preguntas: input.preguntas ?? [],
        fecha_inicio: input.fecha_inicio ?? null,
        fecha_fin: input.fecha_fin ?? null,
        estado: "borrador",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[encuestas] createEncuesta:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateEncuesta(
  id: string,
  input: {
    titulo?: string;
    descripcion?: string;
    preguntas?: unknown[];
    estado?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("encuestas")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[encuestas] updateEncuesta:", msg);
    return { ok: false, error: msg };
  }
}
