"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);

  const { data } = await supabase

    .from("profiles")

    .select("nombre, apellidos")

    .eq("user_id", user.id)

    .single();
return {
    supabase,
    user,
    empresaId,
    nombre: data ? data.nombre + " " + data.apellidos : null,
  };
}

export async function listMantenimiento() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("mantenimiento")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[mantenimiento] listMantenimiento:", err);
    return { ok: false, data: [] };
  }
}

export async function createIncidenciaMantenimiento(input: {
  desperfecto: string;
  localNombre: string;
  gravedad?: string;
  apuntaDesperfecto?: string;
  reparador?: string;
  comentarios?: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("mantenimiento").insert({
      empresa_id: empresaId,
      desperfecto: input.desperfecto,
      local_nombre: input.localNombre,
      gravedad: input.gravedad ?? "LEVE",
      apunta_desperfecto: input.apuntaDesperfecto ?? null,
      reparador: input.reparador ?? null,
      comentarios: input.comentarios ?? null,
      fecha_publicado: new Date().toISOString().split("T")[0],
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mantenimiento] createIncidencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateIncidencia(
  id: string,
  updates: {
    desperfecto?: string;
    localNombre?: string;
    estado?: string;
    gravedad?: string;
    apuntaDesperfecto?: string;
    reparador?: string;
    comentarios?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    // Convert camelCase inputs to snake_case DB fields
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.desperfecto !== undefined)
      dbUpdates.desperfecto = updates.desperfecto;
    if (updates.localNombre !== undefined)
      dbUpdates.local_nombre = updates.localNombre;
    if (updates.estado !== undefined) dbUpdates.estado = updates.estado;
    if (updates.gravedad !== undefined) dbUpdates.gravedad = updates.gravedad;
    if (updates.apuntaDesperfecto !== undefined)
      dbUpdates.apunta_desperfecto = updates.apuntaDesperfecto;
    if (updates.reparador !== undefined)
      dbUpdates.reparador = updates.reparador;
    if (updates.comentarios !== undefined)
      dbUpdates.comentarios = updates.comentarios;

    const { error } = await supabase
      .from("mantenimiento")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mantenimiento] updateIncidencia:", msg);
    return { ok: false, error: msg };
  }
}

export async function addActualizacion(
  incidenciaId: string,
  texto: string,
  apuntadoPor: string
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("mantenimiento_actualizaciones")
      .insert({
        incidencia_id: incidenciaId,
        texto,
        apuntado_por: apuntadoPor,
      });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mantenimiento] addActualizacion:", msg);
    return { ok: false, error: msg };
  }
}

export async function listActualizaciones(incidenciaId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("mantenimiento_actualizaciones")
      .select("*")
      .eq("incidencia_id", incidenciaId)
      .order("fecha", { ascending: true });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[mantenimiento] listActualizaciones:", err);
    return { ok: false, data: [] };
  }
}
