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

export async function listClientes() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("clientes_sala")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[clientes] listClientes:", err);
    return { ok: false, data: [] };
  }
}

export async function createCliente(input: {
  nombre: string;
  telefono?: string;
  email?: string;
  clasificacion?: string;
  observaciones?: string;
  preferencias?: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("clientes_sala").insert({
      empresa_id: empresaId,
      nombre: input.nombre,
      telefono: input.telefono ?? null,
      email: input.email ?? null,
      clasificacion: input.clasificacion ?? "NUEVO",
      observaciones: input.observaciones ?? null,
      preferencias: input.preferencias ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] createCliente:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCliente(
  id: string,
  input: {
    nombre?: string;
    telefono?: string;
    email?: string;
    clasificacion?: string;
    observaciones?: string;
    preferencias?: string;
    notas_internas?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("clientes_sala")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] updateCliente:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCliente(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("clientes_sala")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] deleteCliente:", msg);
    return { ok: false, error: msg };
  }
}

export async function incrementarVisita(id: string) {
  try {
    const { supabase } = await getContext();
    // Fetch current visitas
    const { data: cliente, error: fetchErr } = await supabase
      .from("clientes_sala")
      .select("visitas")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from("clientes_sala")
      .update({
        visitas: (cliente?.visitas ?? 0) + 1,
        ultima_visita: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] incrementarVisita:", msg);
    return { ok: false, error: msg };
  }
}
