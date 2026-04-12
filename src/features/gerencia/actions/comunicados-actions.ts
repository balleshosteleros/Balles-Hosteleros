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

export async function listComunicados() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("comunicados")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicados] listComunicados:", err);
    return { ok: false, data: [] };
  }
}

export async function createComunicado(input: {
  titulo: string;
  contenido: string;
  tipo?: string;
  destinatarios?: string[];
  prioridad?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("comunicados")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo,
        contenido: input.contenido,
        tipo: input.tipo ?? "general",
        destinatarios: input.destinatarios ?? [],
        prioridad: input.prioridad ?? "normal",
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] createComunicado:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateComunicado(
  id: string,
  input: {
    titulo?: string;
    contenido?: string;
    tipo?: string;
    prioridad?: string;
    estado?: string;
  }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("comunicados")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] updateComunicado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteComunicado(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("comunicados")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] deleteComunicado:", msg);
    return { ok: false, error: msg };
  }
}
