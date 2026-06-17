"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type { StockMovimiento } from "@/features/logistica/data/kardex";

/** Lee si un producto controla stock (Sí/No) + cuántos movimientos tiene en histórico. */
export async function getControlaStock(
  productoId: string,
): Promise<{ controlaStock: boolean; movimientos: number }> {
  try {
    const { supabase } = await getLogisticaContext();
    const { data: prod } = await supabase
      .from("productos")
      .select("controla_stock")
      .eq("id", productoId)
      .maybeSingle();
    const { count } = await supabase
      .from("stock_movimientos")
      .select("id", { count: "exact", head: true })
      .eq("producto_id", productoId);
    return { controlaStock: (prod?.controla_stock as boolean) ?? true, movimientos: count ?? 0 };
  } catch (err) {
    console.error("[kardex] getControlaStock:", err);
    return { controlaStock: true, movimientos: 0 };
  }
}

/**
 * Cambia el interruptor "Controlar stock" de un producto.
 * NO destructivo: al poner No, el histórico de movimientos se conserva (solo se congela);
 * el producto deja de sumar por albaranes y de descontar por ventas (candado en el kardex).
 */
export async function setControlaStock(
  productoId: string,
  controla: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("productos")
      .update({ controla_stock: controla })
      .eq("id", productoId)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[kardex] setControlaStock:", msg);
    return { ok: false, error: msg };
  }
}

export interface FacturaAgora {
  id: string;
  numero: string | null;
  agora_serie: string | null;
  agora_numero: string | null;
  cerrado_at: string | null;
  comensales: number | null;
  subtotal: number | null;
  iva_total: number | null;
  total: number | null;
  lineas: { id: string; nombre: string | null; cantidad: number; precio_unitario: number | null }[];
}

/** Histórico de movimientos de un producto, filtrable por rango de fechas. RLS por empresa. */
export async function listMovimientosProducto(
  productoId: string,
  rango?: { desde?: string | null; hasta?: string | null },
): Promise<{ ok: boolean; data: StockMovimiento[] }> {
  try {
    const { supabase } = await getLogisticaContext();
    let query = supabase
      .from("stock_movimientos")
      .select("*")
      .eq("producto_id", productoId)
      .order("fecha", { ascending: false });
    if (rango?.desde) query = query.gte("fecha", rango.desde);
    if (rango?.hasta) query = query.lte("fecha", `${rango.hasta}T23:59:59`);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as StockMovimiento[] };
  } catch (err) {
    console.error("[kardex] listMovimientosProducto:", err);
    return { ok: false, data: [] };
  }
}

/** Factura de Ágora (ticket POS) para desplegar inline en una fila de venta. */
export async function getFacturaAgora(
  ticketId: string,
): Promise<{ ok: boolean; data: FacturaAgora | null }> {
  try {
    const { supabase } = await getLogisticaContext();
    const { data: t, error } = await supabase
      .from("pos_tickets")
      .select("id, numero, agora_serie, agora_numero, cerrado_at, comensales, subtotal, iva_total, total")
      .eq("id", ticketId)
      .maybeSingle();
    if (error) throw error;
    if (!t) return { ok: true, data: null };

    const { data: lineas } = await supabase
      .from("pos_ticket_lineas")
      .select("id, nombre, cantidad, precio_unitario")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    return {
      ok: true,
      data: {
        id: t.id as string,
        numero: (t.numero as string) ?? null,
        agora_serie: (t.agora_serie as string) ?? null,
        agora_numero: (t.agora_numero as string) ?? null,
        cerrado_at: (t.cerrado_at as string) ?? null,
        comensales: (t.comensales as number) ?? null,
        subtotal: (t.subtotal as number) ?? null,
        iva_total: (t.iva_total as number) ?? null,
        total: (t.total as number) ?? null,
        lineas: (lineas ?? []).map((l) => ({
          id: l.id as string,
          nombre: (l.nombre as string) ?? null,
          cantidad: Number(l.cantidad ?? 0),
          precio_unitario: (l.precio_unitario as number) ?? null,
        })),
      },
    };
  } catch (err) {
    console.error("[kardex] getFacturaAgora:", err);
    return { ok: false, data: null };
  }
}
