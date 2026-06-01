"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservaEtiqueta } from "@/features/sala/data/reservas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

function rowToEtiqueta(row: Record<string, unknown>): ReservaEtiqueta {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    nombre: row.nombre as string,
    emoji: (row.emoji as string | null) ?? null,
    color: row.color as string,
    orden: (row.orden as number) ?? 0,
    activo: (row.activo as boolean) ?? true,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listReservaEtiquetas(opts?: { soloActivos?: boolean }) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaEtiqueta[] };
    const q = supabase
      .from("empresa_reserva_etiquetas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (opts?.soloActivos) q.eq("activo", true);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToEtiqueta) };
  } catch (err) {
    console.error("[reserva-etiquetas] list:", err);
    return { ok: false, data: [] as ReservaEtiqueta[] };
  }
}

export async function createReservaEtiqueta(input: {
  nombre: string;
  emoji?: string | null;
  color?: string;
  orden?: number;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };
    const { data, error } = await supabase
      .from("empresa_reserva_etiquetas")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        emoji: input.emoji ?? null,
        color: input.color ?? "#7c3aed",
        orden: input.orden ?? 0,
        activo: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: data ? rowToEtiqueta(data) : null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-etiquetas] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateReservaEtiqueta(id: string, updates: {
  nombre?: string;
  emoji?: string | null;
  color?: string;
  orden?: number;
  activo?: boolean;
}) {
  try {
    const { supabase } = await getCtx();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.nombre !== undefined) dbUpdates.nombre = updates.nombre.trim();
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.orden !== undefined) dbUpdates.orden = updates.orden;
    if (updates.activo !== undefined) dbUpdates.activo = updates.activo;
    const { error } = await supabase
      .from("empresa_reserva_etiquetas")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-etiquetas] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteReservaEtiqueta(id: string) {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase
      .from("empresa_reserva_etiquetas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reserva-etiquetas] delete:", msg);
    return { ok: false, error: msg };
  }
}
