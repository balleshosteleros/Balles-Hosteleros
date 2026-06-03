"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  TIPOS_DECORACION,
  type SalaDecoracion,
  type TipoDecoracion,
} from "@/features/sala/planos/data/planos";

function rowToDecoracion(r: Record<string, unknown>): SalaDecoracion {
  return {
    id: r.id as string,
    salaId: r.sala_id as string,
    tipo: r.tipo as TipoDecoracion,
    x: Number(r.x),
    y: Number(r.y),
    rotation: Number(r.rotation),
    width: Number(r.width),
    height: Number(r.height),
  };
}

export async function listSalaDecoraciones(salaId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sala_decoraciones")
      .select("id, sala_id, tipo, x, y, rotation, width, height")
      .eq("sala_id", salaId);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToDecoracion) };
  } catch (err) {
    console.error("[sala_decoraciones] list:", err);
    return { ok: false, data: [] as SalaDecoracion[] };
  }
}

/**
 * Devuelve TODAS las decoraciones de TODAS las salas del local en una sola
 * consulta. Usado por `loadReservasModuleContext` para evitar N+1.
 */
export async function listSalaDecoracionesByLocal(localId: string) {
  try {
    const supabase = await createClient();
    const { data: salasData, error: e1 } = await supabase
      .from("salas")
      .select("id")
      .eq("local_id", localId);
    if (e1) throw e1;
    const salaIds = (salasData ?? []).map((s: { id: string }) => s.id);
    if (salaIds.length === 0) return { ok: true, data: [] as SalaDecoracion[] };
    const { data, error } = await supabase
      .from("sala_decoraciones")
      .select("id, sala_id, tipo, x, y, rotation, width, height")
      .in("sala_id", salaIds);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToDecoracion) };
  } catch (err) {
    console.error("[sala_decoraciones] list by local:", err);
    return { ok: false, data: [] as SalaDecoracion[] };
  }
}

export async function createSalaDecoracion(input: {
  salaId: string;
  tipo: TipoDecoracion;
  x: number;
  y: number;
  rotation?: number;
  width?: number;
  height?: number;
}) {
  try {
    if (!TIPOS_DECORACION.includes(input.tipo)) {
      return { ok: false, error: "Tipo de decoración inválido." };
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sala_decoraciones")
      .insert({
        sala_id: input.salaId,
        tipo: input.tipo,
        x: input.x,
        y: input.y,
        rotation: input.rotation ?? 0,
        width: input.width ?? 60,
        height: input.height ?? 60,
      })
      .select("id, sala_id, tipo, x, y, rotation, width, height")
      .single();
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true, data: rowToDecoracion(data) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala_decoraciones] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateSalaDecoracion(
  id: string,
  updates: {
    x?: number;
    y?: number;
    rotation?: number;
    width?: number;
    height?: number;
  },
) {
  try {
    const supabase = await createClient();
    const patch: Record<string, unknown> = {};
    if (updates.x !== undefined) patch.x = updates.x;
    if (updates.y !== undefined) patch.y = updates.y;
    if (updates.rotation !== undefined) patch.rotation = updates.rotation;
    if (updates.width !== undefined) patch.width = updates.width;
    if (updates.height !== undefined) patch.height = updates.height;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("sala_decoraciones")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala_decoraciones] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteSalaDecoracion(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("sala_decoraciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala_decoraciones] delete:", msg);
    return { ok: false, error: msg };
  }
}
