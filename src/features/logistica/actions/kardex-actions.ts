"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type { DocumentoTipo, StockMovimiento } from "@/features/logistica/data/kardex";
import { friendlyError } from "@/shared/lib/friendly-errors";

/** Un movimiento del almacén con el nombre del producto ya resuelto (para la vista general). */
export interface MovimientoAlmacen extends StockMovimiento {
  productoNombre: string;
  productoMedida: string | null;
}

/**
 * Todos los movimientos de stock de la empresa (kardex de almacén), con el nombre del
 * producto resuelto. Vista general "qué entró, qué salió, por qué y cuándo" (Iván 14-ago).
 * Hoy casi todo son entradas por albarán; se irá llenando cuando ventas/mermas/inventarios
 * empiecen a descontar. Ordena por fecha desc; el filtro por nombre se aplica en memoria.
 */
export async function listMovimientosAlmacen(filtros?: {
  desde?: string | null;
  hasta?: string | null;
  documentoTipo?: DocumentoTipo | null;
  busqueda?: string | null;
  limite?: number;
}): Promise<{ ok: boolean; data: MovimientoAlmacen[]; error?: string }> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, data: [] };

    let query = supabase
      .from("stock_movimientos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(filtros?.limite ?? 500, 2000));
    if (filtros?.desde) query = query.gte("fecha", filtros.desde);
    if (filtros?.hasta) query = query.lte("fecha", `${filtros.hasta}T23:59:59`);
    if (filtros?.documentoTipo) query = query.eq("documento_tipo", filtros.documentoTipo);

    const [{ data: movs, error }, { data: prods }] = await Promise.all([
      query,
      supabase.from("productos").select("id, nombre, medida").eq("empresa_id", empresaId),
    ]);
    if (error) throw error;

    const nombre = new Map<string, { nombre: string; medida: string | null }>();
    for (const p of prods ?? []) {
      nombre.set(p.id as string, { nombre: (p.nombre as string) ?? "—", medida: (p.medida as string | null) ?? null });
    }

    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const buscar = filtros?.busqueda?.trim() ? norm(filtros.busqueda.trim()) : null;

    const data: MovimientoAlmacen[] = ((movs ?? []) as StockMovimiento[])
      .map((m) => {
        const info = nombre.get(m.producto_id);
        return { ...m, productoNombre: info?.nombre ?? "—", productoMedida: info?.medida ?? null };
      })
      .filter((m) => !buscar || norm(m.productoNombre).includes(buscar) || norm(m.referencia ?? "").includes(buscar));

    return { ok: true, data };
  } catch (err) {
    console.error("[kardex] listMovimientosAlmacen:", err);
    return { ok: false, data: [], error: friendlyError(err, "norm") };
  }
}

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
  lineas: {
    id: string;
    nombre: string | null;
    cantidad: number;
    precio_unitario: number | null;
    /**
     * Complementos de la línea (sabor del tabaco, cápsula, guarnición, refresco del
     * combinado). Consumen almacén aunque no tengan precio propio, así que se ven aquí:
     * si no, el historial diría que un café gastó solo café.
     */
    complementos: {
      id: string;
      nombre: string | null;
      ratio: number;
      /** false = no existe el producto en Balles → ese consumo no se descuenta. */
      enlazado: boolean;
    }[];
  }[];
}

/** Histórico de movimientos de un producto, filtrable por rango de fechas. RLS por empresa. */
export async function listMovimientosProducto(
  productoId: string,
  rango?: { desde?: string | null; hasta?: string | null },
): Promise<{ ok: boolean; data: StockMovimiento[]; error?: string }> {
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
    return { ok: false, data: [], error: friendlyError(err, "listMovimientosProducto") };
  }
}

/** Factura de Ágora (ticket POS) para desplegar inline en una fila de venta. */
export async function getFacturaAgora(
  ticketId: string,
): Promise<{ ok: boolean; data: FacturaAgora | null; error?: string }> {
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

    // Complementos de esas líneas, para colgarlos debajo de la suya.
    const lineaIds = (lineas ?? []).map((l) => l.id as string);
    const complementosPorLinea = new Map<string, FacturaAgora["lineas"][number]["complementos"]>();
    if (lineaIds.length > 0) {
      const { data: addins } = await supabase
        .from("pos_ticket_linea_addins")
        .select("id, linea_id, nombre, ratio, producto_id")
        .in("linea_id", lineaIds);
      for (const a of addins ?? []) {
        const arr = complementosPorLinea.get(a.linea_id as string) ?? [];
        arr.push({
          id: a.id as string,
          nombre: (a.nombre as string) ?? null,
          ratio: Number(a.ratio ?? 1),
          enlazado: a.producto_id != null,
        });
        complementosPorLinea.set(a.linea_id as string, arr);
      }
    }

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
          complementos: complementosPorLinea.get(l.id as string) ?? [],
        })),
      },
    };
  } catch (err) {
    console.error("[kardex] getFacturaAgora:", err);
    return { ok: false, data: null, error: friendlyError(err, "getFacturaAgora") };
  }
}
