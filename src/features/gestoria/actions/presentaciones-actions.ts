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

export async function listPresentaciones() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("presentaciones")
      .select("*")
      .order("fecha_limite", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[presentaciones] listPresentaciones:", err);
    return { ok: false, data: [] };
  }
}

export async function createPresentacion(input: {
  titulo: string;
  tipo: string;
  fecha_limite: string;
  periodo?: string;
  notas?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("presentaciones")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo,
        tipo: input.tipo,
        fecha_limite: input.fecha_limite,
        periodo: input.periodo ?? null,
        notas: input.notas ?? null,
        estado: "pendiente",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] createPresentacion:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePresentacion(
  id: string,
  input: {
    titulo?: string;
    tipo?: string;
    fecha_limite?: string;
    periodo?: string;
    notas?: string;
    estado?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("presentaciones")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] updatePresentacion:", msg);
    return { ok: false, error: msg };
  }
}
