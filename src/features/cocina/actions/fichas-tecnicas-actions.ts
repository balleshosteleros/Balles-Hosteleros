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

export async function listFichas() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("fichas_tecnicas")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[fichas-tecnicas] listFichas:", err);
    return { ok: false, data: [] };
  }
}

export async function createFicha(input: {
  nombre: string;
  categoria?: string;
  raciones?: number;
  tiempo_elaboracion?: number;
  notas?: string;
  ingredientes?: { producto_nombre: string; cantidad: number; unidad?: string; coste?: number }[];
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: ficha, error: fichaErr } = await supabase
      .from("fichas_tecnicas")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        categoria: input.categoria ?? null,
        raciones: input.raciones ?? null,
        tiempo_elaboracion: input.tiempo_elaboracion ?? null,
        notas: input.notas ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (fichaErr) throw fichaErr;

    if (input.ingredientes && input.ingredientes.length > 0) {
      const rows = input.ingredientes.map((ing) => ({
        ficha_id: ficha.id,
        producto_nombre: ing.producto_nombre,
        cantidad: ing.cantidad,
        unidad: ing.unidad ?? "kg",
        coste: ing.coste ?? 0,
      }));
      const { error: ingErr } = await supabase
        .from("ingredientes_ficha")
        .insert(rows);
      if (ingErr) throw ingErr;
    }

    return { ok: true, data: ficha };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichas-tecnicas] createFicha:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateFicha(
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
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("fichas_tecnicas")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichas-tecnicas] updateFicha:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteFicha(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("fichas_tecnicas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichas-tecnicas] deleteFicha:", msg);
    return { ok: false, error: msg };
  }
}
