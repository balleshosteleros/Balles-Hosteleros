"use server";

import { getAppContext } from "@/lib/supabase/get-context";

// ─────────────────────────────────────────────────────────────────────────────
// Análisis de márgenes de escandallos.
//
// Reconstruye el coste de cada escandallo en DOS momentos —"antes" y "ahora"—
// a partir del histórico de precios de compra (producto_precios_compra), sin
// tocar el esquema. El coste de un escandallo es Σ (cantidad × precio del
// ingrediente), siguiendo la MISMA convención que la UI de escandallos
// (producto.coste × cantidad, sin conversión de unidad). Así detectamos qué
// escandallos han perdido margen porque un ingrediente subió de precio, en
// cuántos puntos y cuántos euros por ración.
//
// Ventanas de comparación ("antes"):
//   - "ultimo_cambio": el coste justo ANTES de la última subida de precio de
//     cada ingrediente (nivel de precio inmediatamente anterior al vigente).
//   - "mes" | "trimestre" | "ano": el coste con los precios vigentes hace
//     30 / 90 / 365 días.
// ─────────────────────────────────────────────────────────────────────────────

export type PeriodoMargen = "ultimo_cambio" | "mes" | "trimestre" | "ano";

const DIAS_POR_PERIODO: Record<Exclude<PeriodoMargen, "ultimo_cambio">, number> = {
  mes: 30,
  trimestre: 90,
  ano: 365,
};

export interface IngredienteSubida {
  nombre: string;
  productoId: string | null;
  cantidad: number;
  unidad: string;
  /** Precio unitario del ingrediente en el momento "antes". */
  precioAntes: number;
  /** Precio unitario del ingrediente "ahora". */
  precioAhora: number;
  /** Sobrecoste que aporta este ingrediente a la ración (cantidad × Δprecio). */
  deltaEur: number;
  /** Fecha (YYYY-MM-DD) en que entró en vigor el precio actual, si se conoce. */
  fechaSubida: string | null;
}

export interface EscandalloMargenRow {
  id: string;
  nombre: string;
  categoria: string | null;
  pvp: number;
  costeAntes: number;
  costeAhora: number;
  margenAntes: number; // %
  margenAhora: number; // %
  /** Puntos porcentuales perdidos (margenAntes - margenAhora), > 0 = ha bajado. */
  deltaPts: number;
  /** Sobrecoste por ración en € (costeAhora - costeAntes). */
  deltaEur: number;
  /** Ingredientes responsables de la subida, de mayor a menor impacto. */
  culpables: IngredienteSubida[];
}

interface PrecioRow {
  precio: number;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Precio vigente en una fecha: max(fecha_inicio) <= fecha y fecha_fin válida. */
function precioVigenteEn(rows: PrecioRow[], iso: string): number | null {
  let mejor: PrecioRow | null = null;
  for (const r of rows) {
    if (r.fecha_inicio > iso) continue;
    if (r.fecha_fin != null && r.fecha_fin < iso) continue;
    if (!mejor || r.fecha_inicio > mejor.fecha_inicio) mejor = r;
  }
  if (mejor) return Number(mejor.precio);
  // La fecha pedida es anterior a todo el histórico conocido: usamos el precio
  // más antiguo como línea base (no había registro, pero el coste existía).
  if (rows.length > 0) {
    const masAntiguo = rows.reduce((a, b) => (a.fecha_inicio <= b.fecha_inicio ? a : b));
    return Number(masAntiguo.precio);
  }
  return null;
}

/** Nivel de precio inmediatamente anterior al vigente hoy (distinto en importe). */
function precioAnterior(rows: PrecioRow[]): { precio: number; fechaVigente: string } | null {
  const hoy = todayIso();
  // Vigente hoy
  let vigente: PrecioRow | null = null;
  for (const r of rows) {
    if (r.fecha_inicio > hoy) continue;
    if (r.fecha_fin != null && r.fecha_fin < hoy) continue;
    if (!vigente || r.fecha_inicio > vigente.fecha_inicio) vigente = r;
  }
  if (!vigente) return null;
  // Filas anteriores a la vigente con importe distinto, la más reciente.
  let anterior: PrecioRow | null = null;
  for (const r of rows) {
    if (r.fecha_inicio >= vigente.fecha_inicio) continue;
    if (Number(r.precio) === Number(vigente.precio)) continue;
    if (!anterior || r.fecha_inicio > anterior.fecha_inicio) anterior = r;
  }
  if (!anterior) return null;
  return { precio: Number(anterior.precio), fechaVigente: vigente.fecha_inicio };
}

function precioVigenteHoy(rows: PrecioRow[]): { precio: number; fechaInicio: string } | null {
  const hoy = todayIso();
  let vigente: PrecioRow | null = null;
  for (const r of rows) {
    if (r.fecha_inicio > hoy) continue;
    if (r.fecha_fin != null && r.fecha_fin < hoy) continue;
    if (!vigente || r.fecha_inicio > vigente.fecha_inicio) vigente = r;
  }
  if (vigente) return { precio: Number(vigente.precio), fechaInicio: vigente.fecha_inicio };
  if (rows.length > 0) {
    const reciente = rows.reduce((a, b) => (a.fecha_inicio >= b.fecha_inicio ? a : b));
    return { precio: Number(reciente.precio), fechaInicio: reciente.fecha_inicio };
  }
  return null;
}

function margenPct(pvp: number, coste: number): number {
  if (pvp <= 0) return 0;
  return ((pvp - coste) / pvp) * 100;
}

interface IngredienteRaw {
  producto_id: string | null;
  nombre: string | null;
  cantidad: number | null;
  unidad: string | null;
  coste_unitario: number | null;
}

/**
 * Devuelve los 5 escandallos cuyo margen MÁS ha bajado en la ventana indicada,
 * con el desglose por ingrediente responsable.
 */
export async function analiticaMargenesEscandallos(
  periodo: PeriodoMargen = "mes",
): Promise<{ ok: boolean; data: EscandalloMargenRow[] }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const { data: escandallos, error } = await supabase
      .from("escandallos")
      .select(
        "id, nombre, categoria, pvp, estado, ingredientes:escandallo_ingredientes(producto_id, nombre, cantidad, unidad, coste_unitario)",
      )
      .eq("empresa_id", empresaId);
    if (error) throw error;

    // Recolectar todos los productos referenciados para cargar su histórico de
    // precios de una sola pasada.
    const productoIds = new Set<string>();
    for (const e of escandallos ?? []) {
      for (const ing of (e.ingredientes ?? []) as IngredienteRaw[]) {
        if (ing.producto_id) productoIds.add(ing.producto_id);
      }
    }

    const preciosPorProducto = new Map<string, PrecioRow[]>();
    if (productoIds.size > 0) {
      const { data: precios, error: ePrecios } = await supabase
        .from("producto_precios_compra")
        .select("producto_id, precio, fecha_inicio, fecha_fin")
        .in("producto_id", Array.from(productoIds));
      if (ePrecios) throw ePrecios;
      for (const p of precios ?? []) {
        const id = p.producto_id as string;
        if (!preciosPorProducto.has(id)) preciosPorProducto.set(id, []);
        preciosPorProducto.get(id)!.push({
          precio: Number(p.precio),
          fecha_inicio: p.fecha_inicio as string,
          fecha_fin: (p.fecha_fin as string | null) ?? null,
        });
      }
    }

    const refDate =
      periodo === "ultimo_cambio" ? null : shiftIsoDays(todayIso(), -DIAS_POR_PERIODO[periodo]);

    const filas: EscandalloMargenRow[] = [];

    for (const e of escandallos ?? []) {
      const pvp = Number(e.pvp ?? 0);
      const ingredientes = (e.ingredientes ?? []) as IngredienteRaw[];

      let costeAntes = 0;
      let costeAhora = 0;
      const culpables: IngredienteSubida[] = [];

      for (const ing of ingredientes) {
        const cantidad = Number(ing.cantidad ?? 0);
        const costeUnit = Number(ing.coste_unitario ?? 0);
        const rows = ing.producto_id ? preciosPorProducto.get(ing.producto_id) : undefined;

        let unitAhora = costeUnit;
        let unitAntes = costeUnit;
        let fechaSubida: string | null = null;

        if (rows && rows.length > 0) {
          const vig = precioVigenteHoy(rows);
          if (vig) {
            unitAhora = vig.precio;
            fechaSubida = vig.fechaInicio;
          }
          if (periodo === "ultimo_cambio") {
            const ant = precioAnterior(rows);
            unitAntes = ant ? ant.precio : unitAhora;
          } else if (refDate) {
            const p = precioVigenteEn(rows, refDate);
            unitAntes = p != null ? p : unitAhora;
          }
        }

        const contribAhora = cantidad * unitAhora;
        const contribAntes = cantidad * unitAntes;
        costeAhora += contribAhora;
        costeAntes += contribAntes;

        if (contribAhora > contribAntes + 0.0001) {
          culpables.push({
            nombre: ing.nombre ?? "",
            productoId: ing.producto_id ?? null,
            cantidad,
            unidad: ing.unidad ?? "ud",
            precioAntes: +unitAntes.toFixed(4),
            precioAhora: +unitAhora.toFixed(4),
            deltaEur: +(contribAhora - contribAntes).toFixed(2),
            fechaSubida,
          });
        }
      }

      costeAntes = +costeAntes.toFixed(2);
      costeAhora = +costeAhora.toFixed(2);

      // Sólo nos interesan los que han PERDIDO margen (coste al alza).
      if (costeAhora <= costeAntes + 0.0001) continue;
      if (pvp <= 0) continue;

      const margenAntes = margenPct(pvp, costeAntes);
      const margenAhora = margenPct(pvp, costeAhora);

      culpables.sort((a, b) => b.deltaEur - a.deltaEur);

      filas.push({
        id: e.id as string,
        nombre: (e.nombre as string) ?? "",
        categoria: (e.categoria as string | null) ?? null,
        pvp,
        costeAntes,
        costeAhora,
        margenAntes: +margenAntes.toFixed(1),
        margenAhora: +margenAhora.toFixed(1),
        deltaPts: +(margenAntes - margenAhora).toFixed(1),
        deltaEur: +(costeAhora - costeAntes).toFixed(2),
        culpables,
      });
    }

    // Ranking: mayor caída de margen (puntos) primero; desempate por € de sobrecoste.
    filas.sort((a, b) => b.deltaPts - a.deltaPts || b.deltaEur - a.deltaEur);

    return { ok: true, data: filas.slice(0, 5) };
  } catch (err) {
    console.error("[escandallos] analiticaMargenesEscandallos:", err);
    return { ok: false, data: [] };
  }
}

export interface AlbaranConProducto {
  albaranId: string;
  numero: string;
  numeroProveedor: string | null;
  proveedor: string;
  fecha: string;
  estado: string;
  /** El albarán contiene el producto que subió de precio. */
  contiene: boolean;
  /** Precio unitario del producto en este albarán (si lo contiene). */
  precioUC: number | null;
  cantidad: number | null;
  unidad: string | null;
}

interface LineaAlbaranJson {
  productoId?: string;
  producto?: string;
  cantidad?: number;
  unidad?: string;
  precioUC?: number;
}

/**
 * Últimos albaranes de la empresa marcando los que contienen el producto que
 * subió de precio (con su precio en cada uno, para ver la subida albarán a
 * albarán). Sirve de "por qué" del drill-down de margen.
 */
export async function albaranesRecientesConProducto(
  productoId: string,
  limit = 12,
): Promise<{ ok: boolean; data: AlbaranConProducto[] }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId || !productoId) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("albaranes")
      .select("id, numero, numero_proveedor, proveedor_nombre, fecha, estado, lineas")
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const filas: AlbaranConProducto[] = [];
    for (const alb of data ?? []) {
      const lineas = Array.isArray(alb.lineas) ? (alb.lineas as LineaAlbaranJson[]) : [];
      const linea = lineas.find((l) => l.productoId === productoId);
      filas.push({
        albaranId: alb.id as string,
        numero: (alb.numero as string) ?? "",
        numeroProveedor: (alb.numero_proveedor as string | null) ?? null,
        proveedor: (alb.proveedor_nombre as string) ?? "",
        fecha: (alb.fecha as string) ?? "",
        estado: (alb.estado as string) ?? "",
        contiene: !!linea,
        precioUC: linea ? Number(linea.precioUC ?? 0) : null,
        cantidad: linea ? Number(linea.cantidad ?? 0) : null,
        unidad: linea?.unidad ?? null,
      });
    }

    return { ok: true, data: filas };
  } catch (err) {
    console.error("[escandallos] albaranesRecientesConProducto:", err);
    return { ok: false, data: [] };
  }
}
