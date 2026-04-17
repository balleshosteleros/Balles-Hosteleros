"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";

type RecetaInput = {
  nombre: string;
  descripcion?: string;
  destino: "cocina" | "sala" | "ambos";
};

type PasoUpdate = {
  fotos_marketing?: boolean;
  cata_1?: boolean;
  cata_2?: boolean;
  grabar_producto?: boolean;
  ficha_proveedor?: boolean;
};

async function getContext() {
  const { supabase, userId, empresaId } = await getAppContext();
  let nombre: string | null = null;
  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("nombre, apellidos")
      .eq("user_id", userId)
      .single();
    if (data) nombre = `${data.nombre} ${data.apellidos}`;
  }
  return { supabase, userId, empresaId, nombre };
}

export async function listNuevasRecetas() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("nuevas_recetas")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[recetas] list:", err);
    return { ok: false, data: [] };
  }
}

export async function createNuevaReceta(input: RecetaInput) {
  try {
    const { supabase, userId, empresaId, nombre } = await getContext();
    const { error } = await supabase.from("nuevas_recetas").insert({
      ...input,
      empresa_id: empresaId ?? "",
      propuesto_por: userId ?? null,
      propuesto_por_nombre: nombre ?? "Desconocido",
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateRecetaPasos(id: string, pasos: PasoUpdate) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("nuevas_recetas")
      .update({ ...pasos, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas] updatePasos:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateRecetaEstado(id: string, estado: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("nuevas_recetas")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas] updateEstado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteNuevaReceta(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("nuevas_recetas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[recetas] delete:", msg);
    return { ok: false, error: msg };
  }
}
