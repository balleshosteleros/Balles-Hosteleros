"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MesaPosicion } from "@/features/sala/planos/data/planos";

function rowToPos(r: Record<string, unknown>): MesaPosicion {
  return {
    mesaId: r.id as string,
    x: Number(r.x),
    y: Number(r.y),
    rotation: Number(r.rotation),
  };
}

/** Posiciones de TODAS las mesas colocadas en el local. */
export async function listMesaPosicionesLocal(localId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mesas")
      .select("id, x, y, rotation")
      .eq("local_id", localId)
      .not("x", "is", null)
      .not("y", "is", null);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToPos) };
  } catch (err) {
    console.error("[mesa_posiciones] list local:", err);
    return { ok: false, data: [] as MesaPosicion[] };
  }
}

/** Posiciones de las mesas colocadas en una sala concreta. */
export async function listMesaPosicionesSala(salaId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mesas")
      .select("id, x, y, rotation, zonas!inner(sala_id)")
      .eq("zonas.sala_id", salaId)
      .not("x", "is", null)
      .not("y", "is", null);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToPos) };
  } catch (err) {
    console.error("[mesa_posiciones] list sala:", err);
    return { ok: false, data: [] as MesaPosicion[] };
  }
}

export async function upsertMesaPosicion(input: {
  mesaId: string;
  x: number;
  y: number;
  rotation?: number;
}) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("mesas")
      .update({
        x: input.x,
        y: input.y,
        rotation: input.rotation ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.mesaId);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mesa_posiciones] upsert:", msg);
    return { ok: false, error: msg };
  }
}

export async function removeMesaPosicion(mesaId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("mesas")
      .update({
        x: null,
        y: null,
        rotation: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", mesaId);
    if (error) throw error;
    revalidatePath("/sala/reservas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mesa_posiciones] remove:", msg);
    return { ok: false, error: msg };
  }
}
