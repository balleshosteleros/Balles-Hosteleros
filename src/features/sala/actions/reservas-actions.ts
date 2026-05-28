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

export async function listReservas(fecha?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("reservas")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (fecha) query.eq("fecha", fecha);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reservas] listReservas:", err);
    return { ok: false, data: [] };
  }
}

export async function createReserva(input: {
  clienteNombre: string;
  clienteApellidos?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  fecha: string;
  hora: string;
  personas: number;
  mesa?: string;
  zona?: string;
  turno?: string;
  notas?: string;
  origen?: string | null;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("reservas").insert({
      empresa_id: empresaId,
      cliente_nombre: input.clienteNombre,
      cliente_apellidos: input.clienteApellidos ?? null,
      cliente_telefono: input.clienteTelefono ?? null,
      cliente_email: input.clienteEmail ?? null,
      fecha: input.fecha,
      hora: input.hora,
      personas: input.personas,
      mesa: input.mesa ?? null,
      zona: input.zona ?? null,
      turno: input.turno ?? "COMIDA",
      notas: input.notas ?? null,
      origen: input.origen ?? null,
      created_by: user?.id ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] createReserva:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateReserva(
  id: string,
  updates: {
    clienteNombre?: string;
    clienteApellidos?: string;
    clienteTelefono?: string;
    clienteEmail?: string;
    fecha?: string;
    hora?: string;
    personas?: number;
    mesa?: string;
    zona?: string;
    turno?: string;
    estado?: string;
    notas?: string;
    origen?: string | null;
  }
) {
  try {
    const { supabase } = await getContext();
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.clienteNombre !== undefined)
      dbUpdates.cliente_nombre = updates.clienteNombre;
    if (updates.clienteApellidos !== undefined)
      dbUpdates.cliente_apellidos = updates.clienteApellidos;
    if (updates.clienteTelefono !== undefined)
      dbUpdates.cliente_telefono = updates.clienteTelefono;
    if (updates.clienteEmail !== undefined)
      dbUpdates.cliente_email = updates.clienteEmail;
    if (updates.fecha !== undefined) dbUpdates.fecha = updates.fecha;
    if (updates.hora !== undefined) dbUpdates.hora = updates.hora;
    if (updates.personas !== undefined) dbUpdates.personas = updates.personas;
    if (updates.mesa !== undefined) dbUpdates.mesa = updates.mesa;
    if (updates.zona !== undefined) dbUpdates.zona = updates.zona;
    if (updates.turno !== undefined) dbUpdates.turno = updates.turno;
    if (updates.estado !== undefined) dbUpdates.estado = updates.estado;
    if (updates.notas !== undefined) dbUpdates.notas = updates.notas;
    if (updates.origen !== undefined) dbUpdates.origen = updates.origen;

    const { error } = await supabase
      .from("reservas")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] updateReserva:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteReserva(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("reservas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas] deleteReserva:", msg);
    return { ok: false, error: msg };
  }
}
