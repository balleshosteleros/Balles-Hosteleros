"use server";

/**
 * Métricas de "control de compras" para el dashboard de Logística:
 *  - Productos de compra SIN producto de venta/elaboración asociado (no aparecen como
 *    ingrediente en ningún escandallo) + gasto del último mes de esos productos y su %.
 *  - El inverso: % del gasto que sí está asociado a venta/elaboración.
 *  - Productos de compra SIN compras en un periodo (7/30/90/365 días).
 *
 * Fuente de gasto: líneas de pedidos (lineas_pedido) cuyo pedido cae en el periodo y no
 * está cancelado. Si no hay pedidos reales todavía, el gasto sale 0 (esperado).
 */
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

function desdeISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

/** Ids de productos de compra de la empresa + set de los que están asociados a un escandallo. */
async function compraYAsociados(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  empresaId: string,
) {
  const { data: prods } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("tipo", "compra");
  const productos = (prods ?? []) as { id: string; nombre: string }[];
  const ids = productos.map((p) => p.id);
  const asociados = new Set<string>();
  if (ids.length > 0) {
    const { data: ing } = await supabase
      .from("escandallo_ingredientes")
      .select("producto_id")
      .in("producto_id", ids);
    for (const r of (ing ?? []) as { producto_id: string | null }[]) {
      if (r.producto_id) asociados.add(r.producto_id);
    }
  }
  return { productos, asociados };
}

/** Gasto por producto (lineas_pedido) en los últimos `dias`, no cancelados. Map producto_id → €. */
async function gastoPorProducto(
  supabase: Awaited<ReturnType<typeof getLogisticaContext>>["supabase"],
  empresaId: string,
  dias: number,
): Promise<Map<string, number>> {
  const { data: peds } = await supabase
    .from("pedidos")
    .select("id, estado")
    .eq("empresa_id", empresaId)
    .gte("fecha", desdeISO(dias));
  const pedIds = ((peds ?? []) as { id: string; estado: string }[])
    .filter((p) => p.estado !== "Cancelado")
    .map((p) => p.id);
  const gasto = new Map<string, number>();
  if (pedIds.length === 0) return gasto;
  const { data: lineas } = await supabase
    .from("lineas_pedido")
    .select("producto_id, total")
    .in("pedido_id", pedIds);
  for (const l of (lineas ?? []) as { producto_id: string | null; total: number | string }[]) {
    if (!l.producto_id) continue;
    gasto.set(l.producto_id, (gasto.get(l.producto_id) ?? 0) + (Number(l.total) || 0));
  }
  return gasto;
}

export interface ControlCompras {
  total: number;
  sinAsociar: number;
  asociados: number;
  gastoTotal: number;   // € del último mes en productos de compra
  gastoSin: number;     // € en los que NO tienen venta/elaboración
  gastoAsoc: number;    // € en los que SÍ
  pctSin: number;       // 0..100
  pctAsoc: number;      // 0..100
  hayGasto: boolean;    // false → no hay datos de compra todavía
}

/** Recuadros 1 y 2: asociación a venta/elaboración + gasto del último mes (30 días). */
export async function getControlCompras(): Promise<ControlCompras> {
  const vacio: ControlCompras = {
    total: 0, sinAsociar: 0, asociados: 0, gastoTotal: 0, gastoSin: 0, gastoAsoc: 0,
    pctSin: 0, pctAsoc: 0, hayGasto: false,
  };
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return vacio;
    const { productos, asociados } = await compraYAsociados(supabase, empresaId);
    const total = productos.length;
    const asociadosCount = productos.filter((p) => asociados.has(p.id)).length;
    const sinAsociar = total - asociadosCount;

    const gasto = await gastoPorProducto(supabase, empresaId, 30);
    let gastoTotal = 0, gastoSin = 0;
    for (const p of productos) {
      const g = gasto.get(p.id) ?? 0;
      gastoTotal += g;
      if (!asociados.has(p.id)) gastoSin += g;
    }
    const gastoAsoc = Math.round((gastoTotal - gastoSin) * 100) / 100;
    const pctSin = gastoTotal > 0 ? Math.round((gastoSin / gastoTotal) * 100) : 0;
    return {
      total, sinAsociar, asociados: asociadosCount,
      gastoTotal: Math.round(gastoTotal * 100) / 100,
      gastoSin: Math.round(gastoSin * 100) / 100,
      gastoAsoc,
      pctSin, pctAsoc: gastoTotal > 0 ? 100 - pctSin : 0,
      hayGasto: gastoTotal > 0,
    };
  } catch (e) {
    console.error("[control-compras] getControlCompras:", e);
    return vacio;
  }
}

export interface ProductosSinCompras {
  dias: number;
  total: number;       // productos de compra totales
  sinCompras: number;  // sin ninguna compra en el periodo
  productos: { id: string; nombre: string }[]; // listado (máx 200)
}

/** Panel: productos de compra SIN compras en los últimos `dias` (7/30/90/365). */
export async function getProductosSinCompras(dias: number): Promise<ProductosSinCompras> {
  const periodo = [7, 30, 90, 365].includes(dias) ? dias : 30;
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { dias: periodo, total: 0, sinCompras: 0, productos: [] };
    const { productos } = await compraYAsociados(supabase, empresaId);
    const gasto = await gastoPorProducto(supabase, empresaId, periodo);
    const sin = productos.filter((p) => !gasto.has(p.id));
    return {
      dias: periodo,
      total: productos.length,
      sinCompras: sin.length,
      productos: sin.slice(0, 200).map((p) => ({ id: p.id, nombre: p.nombre })),
    };
  } catch (e) {
    console.error("[control-compras] getProductosSinCompras:", e);
    return { dias: periodo, total: 0, sinCompras: 0, productos: [] };
  }
}
