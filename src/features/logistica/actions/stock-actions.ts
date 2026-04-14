"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listStock() {
  try {
    const { supabase, empresaId } = await getContext();
    let query = supabase
      .from("stock")
      .select("*")
      .order("producto_nombre", { ascending: true });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[stock] listStock:", err);
    return { ok: false, data: [] };
  }
}

export async function updateStock(
  id: string,
  input: { cantidad?: number; cantidad_minima?: number; cantidad_maxima?: number; notas?: string }
) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("stock")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] updateStock:", msg);
    return { ok: false, error: msg };
  }
}

export async function sumarStockDesdeAlbaran(
  lineas: { productoId?: string; productoNombre: string; cantidad: number; unidad: string }[]
) {
  if (lineas.length === 0) return { ok: true };
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const now = new Date().toISOString();

    for (const linea of lineas) {
      if (!linea.productoNombre || linea.cantidad <= 0) continue;

      // Buscar fila de stock: primero por producto_id (exacto), luego por nombre
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let existing: any = null;

      if (linea.productoId) {
        const { data } = await supabase
          .from("stock")
          .select("id, cantidad_actual")
          .eq("empresa_id", empresaId)
          .eq("producto_id", linea.productoId)
          .maybeSingle();
        existing = data;
      }

      if (!existing) {
        const { data } = await supabase
          .from("stock")
          .select("id, cantidad_actual")
          .eq("empresa_id", empresaId)
          .ilike("producto_nombre", linea.productoNombre)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        const nuevaCantidad = Number(existing.cantidad_actual ?? 0) + linea.cantidad;
        await supabase
          .from("stock")
          .update({ cantidad_actual: nuevaCantidad, ultimo_movimiento: now })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("stock")
          .insert({
            empresa_id: empresaId,
            producto_id: linea.productoId ?? null,
            producto_nombre: linea.productoNombre,
            cantidad_actual: linea.cantidad,
            unidad: linea.unidad || "ud",
            ultimo_movimiento: now,
          });
      }
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] sumarStockDesdeAlbaran:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateStockBatch(
  updates: { id: string; cantidad_minima?: number; cantidad_maxima?: number }[]
) {
  if (updates.length === 0) return { ok: true };
  try {
    const { supabase } = await getContext();
    const now = new Date().toISOString();
    const results = await Promise.all(
      updates.map(({ id, ...fields }) =>
        supabase.from("stock").update({ ...fields, updated_at: now }).eq("id", id)
      )
    );
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) throw new Error(`${failed.length} actualizaciones fallaron`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[stock] updateStockBatch:", msg);
    return { ok: false, error: msg };
  }
}
