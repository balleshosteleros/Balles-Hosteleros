"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type { TemporadaStock } from "@/features/logistica/data/stock";

async function getContext() {
  const { supabase, empresaId } = await getLogisticaContext();
  return { supabase, empresaId };
}

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export async function listTemporadas(): Promise<{ ok: boolean; data: TemporadaStock[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data: temps, error } = await supabase
      .from("stock_temporada")
      .select("id, nombre, fecha_inicio, fecha_fin, empresa_id")
      .eq("empresa_id", empresaId)
      .order("fecha_inicio", { ascending: true });

    if (error) throw error;
    if (!temps?.length) return { ok: true, data: [] };

    // Cargar reglas de todas las temporadas en una sola query
    const ids = temps.map((t) => t.id);
    const { data: reglas, error: reglasError } = await supabase
      .from("stock_temporada_reglas")
      .select("temporada_id, producto_id, stock_maximo, stock_minimo")
      .in("temporada_id", ids);

    if (reglasError) throw reglasError;

    // Construir overrides por temporada
    const overridesPorTemporada: Record<string, TemporadaStock["overrides"]> = {};
    for (const r of reglas ?? []) {
      if (!overridesPorTemporada[r.temporada_id]) overridesPorTemporada[r.temporada_id] = {};
      overridesPorTemporada[r.temporada_id][r.producto_id] = {
        stockMaximo: Number(r.stock_maximo ?? 0),
        stockSeguridad: Number(r.stock_minimo ?? 0),
      };
    }

    const data: TemporadaStock[] = temps.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      fechaInicio: t.fecha_inicio,
      fechaFin: t.fecha_fin,
      empresaId: t.empresa_id,
      overrides: overridesPorTemporada[t.id] ?? {},
    }));

    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[temporadas] listTemporadas:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── CREAR ────────────────────────────────────────────────────────────────────

export async function createTemporada(
  input: Omit<TemporadaStock, "id" | "empresaId">
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("stock_temporada")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Insertar reglas si hay overrides
    const entries = Object.entries(input.overrides);
    if (entries.length > 0) {
      const reglas = entries.map(([productoId, ov]) => ({
        temporada_id: data.id,
        producto_id: productoId,
        stock_maximo: ov.stockMaximo,
        stock_minimo: ov.stockSeguridad,
      }));
      const { error: reglasError } = await supabase
        .from("stock_temporada_reglas")
        .insert(reglas);
      if (reglasError) throw reglasError;
    }

    return { ok: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[temporadas] createTemporada:", msg);
    return { ok: false, error: msg };
  }
}

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────

export async function updateTemporada(
  id: string,
  input: Omit<TemporadaStock, "id" | "empresaId">
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();

    const { error } = await supabase
      .from("stock_temporada")
      .update({
        nombre: input.nombre,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    // Reemplazar reglas: borrar las antiguas e insertar las nuevas
    await supabase
      .from("stock_temporada_reglas")
      .delete()
      .eq("temporada_id", id);

    const entries = Object.entries(input.overrides);
    if (entries.length > 0) {
      const reglas = entries.map(([productoId, ov]) => ({
        temporada_id: id,
        producto_id: productoId,
        stock_maximo: ov.stockMaximo,
        stock_minimo: ov.stockSeguridad,
      }));
      const { error: reglasError } = await supabase
        .from("stock_temporada_reglas")
        .insert(reglas);
      if (reglasError) throw reglasError;
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[temporadas] updateTemporada:", msg);
    return { ok: false, error: msg };
  }
}

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────

export async function deleteTemporada(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();

    // Las reglas se eliminan por CASCADE en BD
    const { error } = await supabase
      .from("stock_temporada")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[temporadas] deleteTemporada:", msg);
    return { ok: false, error: msg };
  }
}
