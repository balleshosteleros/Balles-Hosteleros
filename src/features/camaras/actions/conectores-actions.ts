"use server";

import { getCamarasContext } from "@/features/camaras/lib/supabase-context";
import {
  generarPairingCode,
  PAIRING_TTL_MIN,
} from "@/features/camaras/lib/pairing";
import type { ConectorPublic, ConectorRow } from "@/features/camaras/types/conector";

const PUBLIC_COLS =
  "id, empresa_id, local_id, nombre, estado, pairing_code, pairing_expira, last_seen_at, fw_version, activo, created_at, updated_at, created_by";

function toPublic(row: Record<string, unknown>): ConectorPublic {
  return row as unknown as ConectorPublic;
}

export async function listConectores() {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId)
      return { ok: false as const, data: [] as ConectorPublic[], error: "Sin empresa activa" };
    const { data, error } = await supabase
      .from("conectores")
      .select(PUBLIC_COLS)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []).map(toPublic) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[conectores] list:", msg);
    return { ok: false as const, data: [] as ConectorPublic[], error: msg };
  }
}

export async function getConector(id: string) {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };
    const { data, error } = await supabase
      .from("conectores")
      .select(PUBLIC_COLS)
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false as const, error: "Conector no encontrado" };
    return { ok: true as const, data: toPublic(data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[conectores] get:", msg);
    return { ok: false as const, error: msg };
  }
}

/** Inserta con un pairing_code único, reintentando si choca con el índice único. */
async function insertConParingUnico(
  supabase: Awaited<ReturnType<typeof getCamarasContext>>["supabase"],
  base: Record<string, unknown>,
) {
  const expira = new Date(Date.now() + PAIRING_TTL_MIN * 60_000).toISOString();
  for (let intento = 0; intento < 5; intento++) {
    const pairing_code = generarPairingCode();
    const { data, error } = await supabase
      .from("conectores")
      .insert({ ...base, pairing_code, pairing_expira: expira, estado: "pendiente" })
      .select(PUBLIC_COLS)
      .single();
    if (!error) return data;
    // 23505 = unique_violation (colisión de pairing_code) → reintentar
    if ((error as { code?: string }).code !== "23505") throw error;
  }
  throw new Error("No se pudo generar un código único");
}

export async function createConector(input: { nombre: string; localId?: string | null }) {
  try {
    const { supabase, empresaId, userId } = await getCamarasContext();
    if (!userId || !empresaId) return { ok: false as const, error: "No autenticado" };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };

    const data = await insertConParingUnico(supabase, {
      empresa_id: empresaId,
      local_id: input.localId ?? null,
      nombre,
      created_by: userId,
    });
    return { ok: true as const, data: toPublic(data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[conectores] create:", msg);
    return { ok: false as const, error: msg };
  }
}

/** Regenera el código de emparejamiento (solo mientras no esté ya emparejado). */
export async function regenerarPairing(id: string) {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const { data: actual, error: e0 } = await supabase
      .from("conectores")
      .select("estado")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (e0) throw e0;
    if (!actual) return { ok: false as const, error: "Conector no encontrado" };
    if ((actual as ConectorRow).estado !== "pendiente")
      return { ok: false as const, error: "El conector ya está emparejado" };

    const expira = new Date(Date.now() + PAIRING_TTL_MIN * 60_000).toISOString();
    for (let intento = 0; intento < 5; intento++) {
      const pairing_code = generarPairingCode();
      const { data, error } = await supabase
        .from("conectores")
        .update({ pairing_code, pairing_expira: expira })
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .select(PUBLIC_COLS)
        .single();
      if (!error) return { ok: true as const, data: toPublic(data) };
      if ((error as { code?: string }).code !== "23505") throw error;
    }
    return { ok: false as const, error: "No se pudo generar un código único" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[conectores] regenerar:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function deleteConector(id: string) {
  try {
    const { supabase, empresaId } = await getCamarasContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };
    const { error } = await supabase
      .from("conectores")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[conectores] delete:", msg);
    return { ok: false as const, error: msg };
  }
}
