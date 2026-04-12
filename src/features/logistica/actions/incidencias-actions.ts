"use server";

import { createClient } from "@/lib/supabase/server";

type IncidenciaInput = {
  producto: string;
  proveedor?: string;
  precio_actual: number;
  precio_nuevo: number;
};

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: data?.empresa_id ?? null };
}

export async function listIncidencias() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("incidencias_precio")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[incidencias] list:", err);
    return { ok: false, data: [] };
  }
}

export async function createIncidencia(input: IncidenciaInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    const variacion = input.precio_actual > 0
      ? ((input.precio_nuevo - input.precio_actual) / input.precio_actual) * 100
      : 0;
    const { error } = await supabase.from("incidencias_precio").insert({
      producto: input.producto,
      proveedor: input.proveedor ?? null,
      precio_actual: input.precio_actual,
      precio_nuevo: input.precio_nuevo,
      variacion_pct: Math.round(variacion * 100) / 100,
      empresa_id: empresaId ?? "",
      registrado_por: user?.id ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[incidencias] create:", msg);
    return { ok: false, error: msg };
  }
}
