"use server";

import { createClient } from "@/lib/supabase/server";

import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
type ReunionInput = {
  titulo: string;
  fecha: string;
  duracion?: string;
  participantes: string[];
  meet_link?: string;
  notas?: string;
};

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
return { supabase, user, empresaId };
}

export async function listReuniones() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("reuniones")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[reuniones] list:", err);
    return { ok: false, data: [] };
  }
}

export async function createReunion(input: ReunionInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    const { error } = await supabase.from("reuniones").insert({
      ...input,
      empresa_id: empresaId ?? "",
      created_by: user?.id ?? null,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[reuniones] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateReunion(id: string, updates: Partial<ReunionInput> & { resumen_ia?: string }) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("reuniones")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[reuniones] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteReunion(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("reuniones").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[reuniones] delete:", msg);
    return { ok: false, error: msg };
  }
}
