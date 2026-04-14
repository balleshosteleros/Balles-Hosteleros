"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export async function listEquipos() {
  try {
    const { supabase, empresaId } = await getAppContext();
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
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("equipos_frio")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        tipo: input.tipo ?? "NEVERA",
        ubicacion: input.ubicacion ?? null,
        temp_min: input.temp_min ?? null,
        temp_max: input.temp_max ?? null,
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

export async function listRegistros(equipoId?: string) {
  try {
    const { supabase } = await getAppContext();
    const query = supabase
      .from("registros_temperatura")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (equipoId) query.eq("equipo_id", equipoId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[temperaturas] listRegistros:", err);
    return { ok: false, data: [] };
  }
}

export async function registrarTemperatura(input: {
  equipo_id: string;
  temperatura: number;
  estado?: string;
  registrado_por?: string;
  notas?: string;
}) {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("registros_temperatura")
      .insert({
        equipo_id: input.equipo_id,
        temperatura: input.temperatura,
        estado: input.estado ?? "OK",
        registrado_por: input.registrado_por ?? null,
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

// Alias para compatibilidad
export const createRegistro = registrarTemperatura;
