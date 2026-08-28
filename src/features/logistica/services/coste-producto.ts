import "server-only";

/**
 * Cuánto costaba un producto en una fecha dada.
 *
 * POR QUÉ EXISTE: el historial de almacén guarda el coste **congelado** en cada movimiento
 * (PRP-080 Fase 1). Para congelarlo hay que saberlo, y hasta ahora cada sitio lo resolvía a
 * su manera: unos leen `productos.precio_compra`, otros `productos.coste`, y la analítica de
 * escandallos tenía su propio buscador de precio vigente en un fichero privado. Tres
 * criterios distintos para la misma pregunta.
 *
 * El orden de preferencia es el mismo que ya seguía el resto del módulo:
 *   1. el histórico de precios de compra vigente en esa fecha — es el dato real;
 *   2. `productos.precio_compra`, que el sistema mantiene como precio vigente;
 *   3. `productos.coste`, el último recurso.
 * Si no hay ninguno, devuelve `null`: **"no se sabe" no es lo mismo que "es gratis"**, y un
 * 0 en el historial sería mentira.
 *
 * Todos los importes van en la UNIDAD DE STOCK. Un albarán puede traer "caja de 12 a 24 €",
 * pero al almacén entran 12 unidades a 2 €.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface PrecioRow {
  precio: number | string;
  fecha_inicio: string;
  fecha_fin: string | null;
}

/** Convierte un importe guardado como texto (formato español) a número. */
export function parsearImporte(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const limpio = String(v).replace(/[^0-9,.-]/g, "").replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Precio vigente en una fecha concreta dentro de un histórico ya cargado.
 * Extraído de `cocina/actions/escandallos-analitica-actions.ts`, donde era privado.
 */
function precioVigenteEn(rows: PrecioRow[], iso: string): number | null {
  let mejor: PrecioRow | null = null;
  for (const r of rows) {
    if (r.fecha_inicio > iso) continue;
    if (r.fecha_fin != null && r.fecha_fin < iso) continue;
    if (!mejor || r.fecha_inicio > mejor.fecha_inicio) mejor = r;
  }
  if (mejor) return Number(mejor.precio);
  // La fecha pedida es anterior a todo el histórico: se usa el precio más antiguo como
  // línea base. No había registro, pero el producto costaba algo.
  if (rows.length > 0) {
    const masAntiguo = rows.reduce((a, b) => (a.fecha_inicio <= b.fecha_inicio ? a : b));
    return Number(masAntiguo.precio);
  }
  return null;
}

/**
 * Coste por unidad de stock de VARIOS productos en una fecha. En lote a propósito: un
 * albarán o un ticket mueven decenas de productos y no queremos una consulta por cada uno.
 *
 * @param fechaISO día del movimiento (YYYY-MM-DD). Por defecto, hoy.
 */
export async function getCostesEnFecha(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  productoIds: string[],
  fechaISO?: string,
): Promise<Map<string, number>> {
  const costes = new Map<string, number>();
  const ids = [...new Set(productoIds.filter(Boolean))];
  if (ids.length === 0) return costes;

  const fecha = (fechaISO ?? new Date().toISOString()).slice(0, 10);

  // 1. Histórico de precios de compra (el dato bueno).
  const porProducto = new Map<string, PrecioRow[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const { data } = await supabase
      .from("producto_precios_compra")
      .select("producto_id, precio, fecha_inicio, fecha_fin")
      .in("producto_id", lote);
    for (const r of (data ?? []) as Array<PrecioRow & { producto_id: string }>) {
      const arr = porProducto.get(r.producto_id) ?? [];
      arr.push(r);
      porProducto.set(r.producto_id, arr);
    }
  }
  for (const [id, rows] of porProducto) {
    const p = precioVigenteEn(rows, fecha);
    if (p != null && Number.isFinite(p)) costes.set(id, p);
  }

  // 2. y 3. Para los que no tienen histórico, la ficha del producto.
  const faltan = ids.filter((id) => !costes.has(id));
  if (faltan.length > 0) {
    for (let i = 0; i < faltan.length; i += 200) {
      const lote = faltan.slice(i, i + 200);
      const { data } = await supabase
        .from("productos")
        .select("id, precio_compra, coste")
        .in("id", lote);
      for (const p of (data ?? []) as Array<{ id: string; precio_compra: unknown; coste: unknown }>) {
        const v = parsearImporte(p.precio_compra) ?? parsearImporte(p.coste);
        if (v != null) costes.set(p.id, v);
      }
    }
  }

  return costes;
}

/** Atajo de un solo producto. Para lotes, usa `getCostesEnFecha`. */
export async function getCosteEnFecha(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  productoId: string,
  fechaISO?: string,
): Promise<number | null> {
  const m = await getCostesEnFecha(supabase, [productoId], fechaISO);
  return m.get(productoId) ?? null;
}
