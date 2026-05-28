"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmpresaReservasExcepcion } from "@/features/sala/data/reservas";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  return { supabase, user, empresaId };
}

function rowToExcepcion(row: Record<string, unknown>): EmpresaReservasExcepcion {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    fecha: row.fecha as string,
    motivo: (row.motivo as string | null) ?? null,
    cupoComida: (row.cupo_comida as number | null) ?? null,
    cupoCena: (row.cupo_cena as number | null) ?? null,
    maxpaxComida: (row.maxpax_comida as number | null) ?? null,
    maxpaxCena: (row.maxpax_cena as number | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listReservasExcepciones(opts?: { desde?: string; hasta?: string }) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as EmpresaReservasExcepcion[] };
    const q = supabase
      .from("empresa_reservas_excepciones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: true });
    if (opts?.desde) q.gte("fecha", opts.desde);
    if (opts?.hasta) q.lte("fecha", opts.hasta);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToExcepcion) };
  } catch (err) {
    console.error("[reservas-excepciones] list:", err);
    return { ok: false, data: [] as EmpresaReservasExcepcion[] };
  }
}

export async function createExcepcion(input: {
  fecha: string;
  motivo?: string | null;
  cupoComida?: number | null;
  cupoCena?: number | null;
  maxpaxComida?: number | null;
  maxpaxCena?: number | null;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.fecha) return { ok: false, error: "Fecha obligatoria" };
    // Regla "Datos completos obligatorio": al menos uno de los 4 valores debe estar.
    const algunValor =
      input.cupoComida != null || input.cupoCena != null ||
      input.maxpaxComida != null || input.maxpaxCena != null;
    if (!algunValor) {
      return { ok: false, error: "Indica al menos un cupo o máximo de personas" };
    }
    const { data, error } = await supabase
      .from("empresa_reservas_excepciones")
      .insert({
        empresa_id: empresaId,
        fecha: input.fecha,
        motivo: input.motivo ?? null,
        cupo_comida: input.cupoComida ?? null,
        cupo_cena: input.cupoCena ?? null,
        maxpax_comida: input.maxpaxComida ?? null,
        maxpax_cena: input.maxpaxCena ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: data ? rowToExcepcion(data) : null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-excepciones] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateExcepcion(id: string, updates: {
  fecha?: string;
  motivo?: string | null;
  cupoComida?: number | null;
  cupoCena?: number | null;
  maxpaxComida?: number | null;
  maxpaxCena?: number | null;
}) {
  try {
    const { supabase } = await getCtx();
    const db: Record<string, unknown> = {};
    if (updates.fecha !== undefined) db.fecha = updates.fecha;
    if (updates.motivo !== undefined) db.motivo = updates.motivo;
    if (updates.cupoComida !== undefined) db.cupo_comida = updates.cupoComida;
    if (updates.cupoCena !== undefined) db.cupo_cena = updates.cupoCena;
    if (updates.maxpaxComida !== undefined) db.maxpax_comida = updates.maxpaxComida;
    if (updates.maxpaxCena !== undefined) db.maxpax_cena = updates.maxpaxCena;
    const { error } = await supabase
      .from("empresa_reservas_excepciones")
      .update(db)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-excepciones] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteExcepcion(id: string) {
  try {
    const { supabase } = await getCtx();
    const { error } = await supabase
      .from("empresa_reservas_excepciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[reservas-excepciones] delete:", msg);
    return { ok: false, error: msg };
  }
}
