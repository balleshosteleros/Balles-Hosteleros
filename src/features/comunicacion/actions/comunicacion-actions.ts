"use server";

import { createClient } from "@/lib/supabase/server";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    nombre: data ? `${data.nombre} ${data.apellidos}` : null,
  };
}

export async function listCanales() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase.from("canales").select("*").order("nombre");
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicacion] listCanales:", err);
    return { ok: false, data: [] };
  }
}

export async function createCanal(nombre: string, tipo: string = "grupo") {
  try {
    const { supabase, empresaId } = await getContext();
    const { data, error } = await supabase
      .from("canales")
      .insert({ nombre, tipo, empresa_id: empresaId ?? "" })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] createCanal:", msg);
    return { ok: false, error: msg };
  }
}

export async function listMensajes(canalId: string) {
  try {
    const { supabase } = await getContext();
    const { data, error } = await supabase
      .from("mensajes")
      .select("*")
      .eq("canal_id", canalId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicacion] listMensajes:", err);
    return { ok: false, data: [] };
  }
}

export async function sendMensaje(canalId: string, texto: string) {
  try {
    const { supabase, user, nombre } = await getContext();
    const { data, error } = await supabase
      .from("mensajes")
      .insert({
        canal_id: canalId,
        autor_id: user?.id ?? null,
        autor_nombre: nombre ?? "Anónimo",
        texto,
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] sendMensaje:", msg);
    return { ok: false, error: msg };
  }
}

export async function toggleFijado(mensajeId: string, fijado: boolean) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("mensajes")
      .update({ fijado })
      .eq("id", mensajeId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[comunicacion] toggleFijado:", msg);
    return { ok: false, error: msg };
  }
}
