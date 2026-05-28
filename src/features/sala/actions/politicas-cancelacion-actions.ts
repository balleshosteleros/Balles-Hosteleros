"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PoliticaCancelacion } from "@/features/sala/data/reservas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

function rowToPolitica(row: Record<string, unknown>): PoliticaCancelacion {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    nombre: row.nombre as string,
    descripcion: (row.descripcion as string | null) ?? null,
    horasAntes: (row.horas_antes as number | null) ?? null,
    penalizacionPct: (row.penalizacion_pct as number | null) ?? null,
    activa: (row.activa as boolean) ?? true,
    orden: (row.orden as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listPoliticasCancelacion(opts?: { soloActivas?: boolean }) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as PoliticaCancelacion[] };
    const q = supabase
      .from("politicas_cancelacion")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (opts?.soloActivas) q.eq("activa", true);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToPolitica) };
  } catch (err) {
    console.error("[politicas-cancelacion] list:", err);
    return { ok: false, data: [] as PoliticaCancelacion[] };
  }
}

export async function createPoliticaCancelacion(input: {
  nombre: string;
  descripcion?: string | null;
  horasAntes?: number | null;
  penalizacionPct?: number | null;
  orden?: number;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };
    const { data, error } = await supabase
      .from("politicas_cancelacion")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion ?? null,
        horas_antes: input.horasAntes ?? null,
        penalizacion_pct: input.penalizacionPct ?? null,
        orden: input.orden ?? 0,
        activa: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: data ? rowToPolitica(data) : null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[politicas-cancelacion] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePoliticaCancelacion(id: string, updates: {
  nombre?: string;
  descripcion?: string | null;
  horasAntes?: number | null;
  penalizacionPct?: number | null;
  orden?: number;
  activa?: boolean;
}) {
  try {
    const { supabase } = await getCtx();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.nombre !== undefined) dbUpdates.nombre = updates.nombre.trim();
    if (updates.descripcion !== undefined) dbUpdates.descripcion = updates.descripcion;
    if (updates.horasAntes !== undefined) dbUpdates.horas_antes = updates.horasAntes;
    if (updates.penalizacionPct !== undefined) dbUpdates.penalizacion_pct = updates.penalizacionPct;
    if (updates.orden !== undefined) dbUpdates.orden = updates.orden;
    if (updates.activa !== undefined) dbUpdates.activa = updates.activa;
    dbUpdates.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("politicas_cancelacion")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[politicas-cancelacion] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePoliticaCancelacion(id: string) {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase
      .from("politicas_cancelacion")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[politicas-cancelacion] delete:", msg);
    return { ok: false, error: msg };
  }
}
