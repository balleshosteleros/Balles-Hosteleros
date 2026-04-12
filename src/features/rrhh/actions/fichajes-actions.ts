"use server";

import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id, nombre, apellidos")
    .eq("user_id", user.id)
    .single();
  return {
    supabase,
    user,
    empresaId: data?.empresa_id ?? null,
    nombre: data ? data.nombre + " " + data.apellidos : null,
  };
}

export async function listFichajes(fecha?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("fichajes")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (fecha) query.eq("fecha", fecha);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[fichajes] listFichajes:", err);
    return { ok: false, data: [] };
  }
}

export async function ficharEntrada() {
  try {
    const { supabase, user, empresaId, nombre } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("fichajes")
      .insert({
        empresa_id: empresaId,
        empleado_id: user.id,
        empleado_nombre: nombre ?? "Sin nombre",
        fecha: new Date().toISOString().split("T")[0],
        hora_entrada: new Date().toISOString(),
        estado: "trabajando",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] ficharEntrada:", msg);
    return { ok: false, error: msg };
  }
}

export async function ficharSalida(fichajeId: string) {
  try {
    const { supabase } = await getContext();
    // Fetch the fichaje to calculate hours
    const { data: fichaje, error: fetchErr } = await supabase
      .from("fichajes")
      .select("hora_entrada")
      .eq("id", fichajeId)
      .single();
    if (fetchErr) throw fetchErr;

    const ahora = new Date();
    let horasTotales = 0;
    if (fichaje?.hora_entrada) {
      const entrada = new Date(fichaje.hora_entrada);
      horasTotales =
        Math.round(((ahora.getTime() - entrada.getTime()) / 3600000) * 100) /
        100;
    }

    const { error } = await supabase
      .from("fichajes")
      .update({
        hora_salida: ahora.toISOString(),
        horas_totales: horasTotales,
        estado: "completado",
      })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true, data: { horas_totales: horasTotales } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] ficharSalida:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateFichaje(
  id: string,
  updates: { notas?: string; estado?: string }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("fichajes")
      .update({
        ...(updates.notas !== undefined && { notas: updates.notas }),
        ...(updates.estado !== undefined && { estado: updates.estado }),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes] updateFichaje:", msg);
    return { ok: false, error: msg };
  }
}
