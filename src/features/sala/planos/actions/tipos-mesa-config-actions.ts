"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  TIPOS_MESA,
  type TipoMesa,
  type TipoMesaConfig,
} from "@/features/sala/planos/data/planos";

function rowToConfig(r: Record<string, unknown>): TipoMesaConfig {
  return {
    id: r.id as string,
    localId: r.local_id as string,
    tipo: r.tipo as TipoMesa,
    visibleCliente: (r.visible_cliente as boolean) ?? true,
    tipoPublico: (r.tipo_publico as TipoMesa | null) ?? null,
    ocultaTotal: (r.oculta_total as boolean) ?? false,
  };
}

/**
 * Devuelve las 4 configuraciones (BARRA/BAJA/MEDIA/ALTA) de un local.
 * Si por algún motivo faltan filas, las inserta con valores por defecto.
 */
export async function listTiposMesaConfig(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tipos_mesa_config")
      .select("*")
      .eq("local_id", localId);
    if (error) throw error;
    const existentes = new Set((data ?? []).map((r) => r.tipo as TipoMesa));
    const faltantes = TIPOS_MESA.filter((t) => !existentes.has(t));
    if (faltantes.length > 0) {
      const toInsert = faltantes.map((t) => ({ local_id: localId, tipo: t }));
      const { data: ins, error: errIns } = await supabase
        .from("tipos_mesa_config")
        .insert(toInsert)
        .select("*");
      if (errIns) throw errIns;
      return {
        ok: true,
        data: [...(data ?? []), ...(ins ?? [])].map(rowToConfig),
      };
    }
    return { ok: true, data: (data ?? []).map(rowToConfig) };
  } catch (err) {
    console.error("[tipos-mesa-config] list:", err);
    return { ok: false, data: [] as TipoMesaConfig[] };
  }
}

export async function updateTipoMesaConfig(
  id: string,
  updates: {
    visibleCliente?: boolean;
    tipoPublico?: TipoMesa | null;
    ocultaTotal?: boolean;
  },
) {
  try {
    const patch: Record<string, unknown> = {};
    if (updates.visibleCliente !== undefined) patch.visible_cliente = updates.visibleCliente;
    if (updates.tipoPublico !== undefined) patch.tipo_publico = updates.tipoPublico;
    if (updates.ocultaTotal !== undefined) patch.oculta_total = updates.ocultaTotal;
    const supabase = await createClient();
    const { error } = await supabase.from("tipos_mesa_config").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[tipos-mesa-config] update:", msg);
    return { ok: false, error: msg };
  }
}
