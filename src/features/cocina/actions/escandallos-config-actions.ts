"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export type GrupoCodigo =
  | "categorias"
  | "alergenos"
  | "partidas"
  | "menaje"
  | "recomendaciones";

export type EscandalloConfigItem = {
  id: string;
  empresa_id: string;
  grupo_codigo: GrupoCodigo;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export async function listConfigItems(grupo: GrupoCodigo) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] as EscandalloConfigItem[], error: "No autenticado" };

    const { data, error } = await supabase
      .from("escandallos_config_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("grupo_codigo", grupo)
      .order("orden", { ascending: true });

    if (error) throw error;
    return { ok: true, data: (data ?? []) as EscandalloConfigItem[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos-config] listConfigItems:", msg);
    return { ok: false, data: [] as EscandalloConfigItem[], error: msg };
  }
}

export async function createConfigItem(input: {
  grupo: GrupoCodigo;
  nombre: string;
  descripcion?: string;
  activa?: boolean;
}) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

    // Calcular siguiente orden
    const { data: ultimo, error: errOrden } = await supabase
      .from("escandallos_config_items")
      .select("orden")
      .eq("empresa_id", empresaId)
      .eq("grupo_codigo", input.grupo)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errOrden) throw errOrden;
    const nextOrden = (ultimo?.orden ?? 0) + 1;

    const { data, error } = await supabase
      .from("escandallos_config_items")
      .insert({
        empresa_id: empresaId,
        grupo_codigo: input.grupo,
        nombre,
        descripcion: input.descripcion?.trim() || null,
        activa: input.activa ?? true,
        orden: nextOrden,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Ya existe un valor con ese nombre" };
      }
      throw error;
    }
    return { ok: true, data: data as EscandalloConfigItem };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos-config] createConfigItem:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateConfigItem(
  id: string,
  input: { nombre?: string; descripcion?: string | null; activa?: boolean; orden?: number }
) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = {};
    if (input.nombre !== undefined) payload.nombre = input.nombre.trim();
    if (input.descripcion !== undefined)
      payload.descripcion = input.descripcion?.toString().trim() || null;
    if (input.activa !== undefined) payload.activa = input.activa;
    if (input.orden !== undefined) payload.orden = input.orden;

    const { data, error } = await supabase
      .from("escandallos_config_items")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Ya existe un valor con ese nombre" };
      }
      throw error;
    }
    return { ok: true, data: data as EscandalloConfigItem };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos-config] updateConfigItem:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteConfigItem(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("escandallos_config_items").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[escandallos-config] deleteConfigItem:", msg);
    return { ok: false, error: msg };
  }
}
