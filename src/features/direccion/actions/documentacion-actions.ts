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

export async function listDocumentos(categoria?: string) {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("documentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    if (categoria) query.eq("categoria", categoria);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[documentacion] listDocumentos:", err);
    return { ok: false, data: [] };
  }
}

export async function createDocumento(input: {
  titulo: string;
  categoria?: string;
  descripcion?: string;
  url_archivo?: string;
  fecha_vencimiento?: string;
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("documentos")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo,
        categoria: input.categoria ?? null,
        descripcion: input.descripcion ?? null,
        url_archivo: input.url_archivo ?? null,
        fecha_vencimiento: input.fecha_vencimiento ?? null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] createDocumento:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteDocumento(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("documentos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentacion] deleteDocumento:", msg);
    return { ok: false, error: msg };
  }
}
