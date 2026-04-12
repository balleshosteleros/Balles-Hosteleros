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

export async function listVencimientos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("vencimientos")
      .select("*")
      .order("fecha_vencimiento", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[vencimientos] listVencimientos:", err);
    return { ok: false, data: [] };
  }
}

export async function createVencimiento(input: {
  titulo: string;
  fecha_vencimiento: string;
  tipo?: string;
  descripcion?: string;
  importe?: number;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("vencimientos")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo,
        fecha_vencimiento: input.fecha_vencimiento,
        tipo: input.tipo ?? null,
        descripcion: input.descripcion ?? null,
        importe: input.importe ?? null,
        estado: "pendiente",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] createVencimiento:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateVencimiento(
  id: string,
  input: {
    titulo?: string;
    fecha_vencimiento?: string;
    tipo?: string;
    descripcion?: string;
    importe?: number;
    estado?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("vencimientos")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[vencimientos] updateVencimiento:", msg);
    return { ok: false, error: msg };
  }
}
