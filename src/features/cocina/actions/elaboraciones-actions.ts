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

export async function listElaboraciones() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("elaboraciones")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[elaboraciones] listElaboraciones:", err);
    return { ok: false, data: [] };
  }
}

export async function createElaboracion(input: {
  nombre: string;
  tipo?: string;
  descripcion?: string;
  tiempo_estimado?: number;
  responsable?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("elaboraciones")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        tipo: input.tipo ?? null,
        descripcion: input.descripcion ?? null,
        tiempo_estimado: input.tiempo_estimado ?? null,
        responsable: input.responsable ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] createElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateElaboracion(
  id: string,
  input: {
    nombre?: string;
    tipo?: string;
    descripcion?: string;
    tiempo_estimado?: number;
    responsable?: string;
    estado?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("elaboraciones")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] updateElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteElaboracion(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("elaboraciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] deleteElaboracion:", msg);
    return { ok: false, error: msg };
  }
}
