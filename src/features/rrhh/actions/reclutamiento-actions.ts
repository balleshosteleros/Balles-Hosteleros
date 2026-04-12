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

export async function listCandidatos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("candidatos")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reclutamiento] listCandidatos:", err);
    return { ok: false, data: [] };
  }
}

export async function createCandidato(input: {
  nombre: string;
  puesto: string;
  email?: string;
  telefono?: string;
  cv_url?: string;
  notas?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("candidatos")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        puesto: input.puesto,
        email: input.email ?? null,
        telefono: input.telefono ?? null,
        cv_url: input.cv_url ?? null,
        notas: input.notas ?? null,
        estado: "nuevo",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] createCandidato:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCandidato(
  id: string,
  input: {
    nombre?: string;
    puesto?: string;
    email?: string;
    telefono?: string;
    cv_url?: string;
    notas?: string;
    estado?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("candidatos")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] updateCandidato:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCandidato(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("candidatos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reclutamiento] deleteCandidato:", msg);
    return { ok: false, error: msg };
  }
}
