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

export async function listEquipos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("equipos_frio")
      .select("*")
      .order("nombre", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[temperaturas] listEquipos:", err);
    return { ok: false, data: [] };
  }
}

export async function createEquipo(input: {
  nombre: string;
  tipo?: string;
  ubicacion?: string;
  temp_min?: number;
  temp_max?: number;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("equipos_frio")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        tipo: input.tipo ?? null,
        ubicacion: input.ubicacion ?? null,
        temp_min: input.temp_min ?? null,
        temp_max: input.temp_max ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[temperaturas] createEquipo:", msg);
    return { ok: false, error: msg };
  }
}

export async function registrarTemperatura(input: {
  equipo_id: string;
  temperatura: number;
  notas?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("registros_temperatura")
      .insert({
        empresa_id: empresaId,
        equipo_id: input.equipo_id,
        temperatura: input.temperatura,
        notas: input.notas ?? null,
        registrado_por: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[temperaturas] registrarTemperatura:", msg);
    return { ok: false, error: msg };
  }
}

export async function listRegistros(equipoId?: string, fecha?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("registros_temperatura")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (equipoId) query.eq("equipo_id", equipoId);
    if (fecha) query.gte("created_at", fecha + "T00:00:00").lte("created_at", fecha + "T23:59:59");
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[temperaturas] listRegistros:", err);
    return { ok: false, data: [] };
  }
}
