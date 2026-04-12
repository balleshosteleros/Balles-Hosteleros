"use server";

import { createClient } from "@/lib/supabase/server";

type PlatoInput = {
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

export async function listNuevosPlatos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("nuevos_platos")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[platos] list:", err);
    return { ok: false, data: [] };
  }
}

export async function createNuevoPlato(input: PlatoInput) {
  try {
    const { supabase, user, empresaId, nombre } = await getContext();
    const { error } = await supabase.from("nuevos_platos").insert({
      ...input,
      empresa_id: empresaId ?? "",
      propuesto_por: user?.id ?? null,
      propuesto_por_nombre: nombre ?? "Desconocido",
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[platos] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePlatoPasos(id: string, pasos: PasoUpdate) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("nuevos_platos")
      .update({ ...pasos, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[platos] updatePasos:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePlatoEstado(id: string, estado: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("nuevos_platos")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[platos] updateEstado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteNuevoPlato(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("nuevos_platos").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[platos] delete:", msg);
    return { ok: false, error: msg };
  }
}
