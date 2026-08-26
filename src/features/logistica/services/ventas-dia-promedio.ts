import "server-only";

/**
 * Cálculo de `productos.ventas_dia_promedio` — cuánto se consume al día de cada
 * producto de COMPRA, deducido de las ventas reales del TPV.
 *
 * POR QUÉ EXISTE: la reposición por ventas (`getSugerenciasPorVentas`) propone el
 * pedido comparando el stock con lo que se gasta al día. Esa columna existía desde
 * la migración 011 pero **no la escribía nadie**, así que estaba a 0 en los ~560
 * productos de compra y la sugerencia por ventas no proponía absolutamente nada.
 *
 * CÓMO SE CALCULA: exactamente igual que descuenta el stock una venta real
 * (`descontar-stock-por-ventas.ts`), para que lo que se propone comprar cuadre con
 * lo que de verdad va a salir del almacén. Dos caminos, los mismos que allí:
 *
 *   1. El producto vendido TIENE receta (`producto_composicion`) → se consume cada
 *      ingrediente: `cantidad × ratio × cantidad_receta × (1 + merma%) / factor_conversion`.
 *   2. NO tiene receta → se consume su gemelo de compra (mismo `agora_id`) por
 *      `cantidad × ratio`. Es el caso de los botellines y refrescos.
 *
 * Un producto de venta sin receta y sin gemelo de compra no consume nada: se ignora
 * (hoy son sobre todo cócteles y platos, ver docs/RECETAS_PENDIENTES_PRIORIZADAS.md).
 * En cuanto alguien escriba su receta, entra solo en este cálculo sin tocar código.
 *
 * ⚠️ LAS UNIDADES DE LAS RECETAS AÚN NO ESTÁN CONFIGURADAS (26-ago-2026).
 * `productos.unidad_uso` está a NULL y `factor_conversion` a 1 en los **693** productos,
 * mientras las recetas guardan la cantidad en gramos ("Cachopo → 350 de Filete de vaca",
 * un producto medido en Kilogramos). Sin la conversión, ese 350 se lee como 350 kg por
 * cachopo. Por eso este cálculo **se salta los ingredientes cuya conversión no está
 * declarada** y los cuenta en `ingredientesSinUnidad` en vez de escribir un número
 * absurdo: es preferible un 0 honesto a proponer comprar 212 kg de filete al día.
 * Los espejos 1:1 (una consumición = una botella/botellín) sí son seguros y sí se
 * calculan, que es de donde sale la mayor parte del volumen.
 * El mismo agujero afecta al descuento de stock (`descontar-stock-por-ventas.ts`), que
 * hoy está desarmado (`empresas.stock_descuento_desde` a NULL): **antes de armarlo hay
 * que rellenar `unidad_uso`/`factor_conversion`**.
 *
 * VENTANA: los últimos N días **hasta ayer**; el día en curso no cuenta porque
 * estaría a medias y hundiría la media. Decisión de negocio ya tomada en
 * docs/LOGISTICA_COMPRAS_PARA_IVAN_reposicion_por_ventas.md.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Días de histórico que entran en la media. 4 semanas completas: absorbe el efecto finde. */
export const DIAS_VENTANA_VENTAS = 28;

export interface VentasDiaPromedioResult {
  empresaId: string;
  /** Días de la ventana (constante, aunque algún día no tenga ventas). */
  dias: number;
  /** Líneas de venta leídas. */
  lineas: number;
  /** Productos de compra con consumo > 0 en la ventana. */
  productosConConsumo: number;
  /** Filas de `productos` realmente actualizadas (solo las que cambian). */
  actualizados: number;
  /** Líneas que no consumían nada (sin receta y sin gemelo de compra). */
  lineasSinDestino: number;
  /**
   * Ingredientes de receta saltados porque su conversión de unidades no está
   * declarada (`unidad_uso` a NULL). Mientras esto sea > 0, la reposición por ventas
   * solo cubre bien las bebidas. Ver la nota de cabecera del módulo.
   */
  ingredientesSinUnidad: number;
}

/** Redondeo a 3 decimales: más precisión no aporta y ensucia comparaciones. */
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Recalcula y persiste `ventas_dia_promedio` de todos los productos de una empresa.
 * Idempotente: se puede ejecutar tantas veces como se quiera.
 */
export async function recalcularVentasDiaPromedio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  empresaId: string,
  dias: number = DIAS_VENTANA_VENTAS,
): Promise<VentasDiaPromedioResult> {
  const vacio: VentasDiaPromedioResult = {
    empresaId,
    dias,
    lineas: 0,
    productosConConsumo: 0,
    actualizados: 0,
    lineasSinDestino: 0,
    ingredientesSinUnidad: 0,
  };

  // ─── Ventana: [hoy - dias, ayer] ambos incluidos ─────────────────────────
  const hoy = new Date();
  const finExcl = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); // hoy 00:00 → excluye hoy
  const inicio = new Date(finExcl.getTime() - dias * 86_400_000);
  const desdeIso = inicio.toISOString();
  const hastaIso = finExcl.toISOString();

  // ─── Tickets de la ventana ───────────────────────────────────────────────
  const { data: tickets, error: errTickets } = await supabase
    .from("pos_tickets")
    .select("id")
    .eq("empresa_id", empresaId)
    .gte("cerrado_at", desdeIso)
    .lt("cerrado_at", hastaIso);
  if (errTickets) throw new Error(`ventas-dia-promedio: tickets — ${errTickets.message}`);

  const ticketIds = (tickets ?? []).map((t) => t.id as string);
  if (ticketIds.length === 0) return vacio;

  // ─── Líneas de esos tickets (por lotes: `in` tiene límite práctico) ──────
  const lineas: { producto_id: string; cantidad: number; ratio: number }[] = [];
  for (let i = 0; i < ticketIds.length; i += 200) {
    const { data, error } = await supabase
      .from("pos_ticket_lineas")
      .select("producto_id, cantidad, sale_format_ratio")
      .in("ticket_id", ticketIds.slice(i, i + 200));
    if (error) throw new Error(`ventas-dia-promedio: líneas — ${error.message}`);
    for (const l of data ?? []) {
      if (!l.producto_id) continue;
      const cantidad = Number(l.cantidad ?? 0);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
      const ratio = Number(l.sale_format_ratio ?? 1) || 1;
      lineas.push({ producto_id: l.producto_id as string, cantidad, ratio });
    }
  }
  if (lineas.length === 0) return vacio;

  // ─── Agregar por producto vendido antes de resolver (menos trabajo) ──────
  const vendidoPorProducto = new Map<string, number>(); // producto_id → unidades base
  for (const l of lineas) {
    vendidoPorProducto.set(l.producto_id, (vendidoPorProducto.get(l.producto_id) ?? 0) + l.cantidad * l.ratio);
  }
  const productoIds = [...vendidoPorProducto.keys()];

  // ─── Tipo y agora_id de lo vendido ───────────────────────────────────────
  const tipoById = new Map<string, string>();
  const agoraById = new Map<string, string | null>();
  const agoraIds = new Set<string>();
  for (let i = 0; i < productoIds.length; i += 200) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, tipo, agora_id")
      .eq("empresa_id", empresaId)
      .in("id", productoIds.slice(i, i + 200));
    if (error) throw new Error(`ventas-dia-promedio: productos vendidos — ${error.message}`);
    for (const p of data ?? []) {
      tipoById.set(p.id as string, p.tipo as string);
      const ag = (p.agora_id as string | null) ?? null;
      agoraById.set(p.id as string, ag);
      if (ag) agoraIds.add(ag);
    }
  }

  // ─── Gemelo de COMPRA por agora_id (camino 2: bebidas sin receta) ────────
  const compraByAgora = new Map<string, string>();
  const agoraIdsArr = [...agoraIds];
  for (let i = 0; i < agoraIdsArr.length; i += 200) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, agora_id")
      .eq("empresa_id", empresaId)
      .eq("tipo", "compra")
      .in("agora_id", agoraIdsArr.slice(i, i + 200));
    if (error) throw new Error(`ventas-dia-promedio: gemelos de compra — ${error.message}`);
    for (const p of data ?? []) if (p.agora_id) compraByAgora.set(p.agora_id as string, p.id as string);
  }

  // ─── Recetas de los productos de venta (camino 1) ────────────────────────
  const ventaIds = productoIds.filter((id) => tipoById.get(id) === "venta");
  const recetaByVenta = new Map<string, { ingredienteId: string; cantidad: number; mermaPct: number }[]>();
  for (let i = 0; i < ventaIds.length; i += 200) {
    const { data, error } = await supabase
      .from("producto_composicion")
      .select("producto_venta_id, ingrediente_id, cantidad, merma_pct")
      .in("producto_venta_id", ventaIds.slice(i, i + 200));
    if (error) throw new Error(`ventas-dia-promedio: recetas — ${error.message}`);
    for (const c of data ?? []) {
      const arr = recetaByVenta.get(c.producto_venta_id as string) ?? [];
      arr.push({
        ingredienteId: c.ingrediente_id as string,
        cantidad: Number(c.cantidad ?? 0),
        mermaPct: Number(c.merma_pct ?? 0),
      });
      recetaByVenta.set(c.producto_venta_id as string, arr);
    }
  }

  // ─── Factor de conversión de los ingredientes (unidad de uso → formato) ──
  const ingredienteIds = new Set<string>();
  for (const arr of recetaByVenta.values()) for (const c of arr) ingredienteIds.add(c.ingredienteId);
  const factorById = new Map<string, number>();
  /** Ingredientes cuya conversión NO está declarada: su cantidad de receta es ambigua. */
  const conversionSinDeclarar = new Set<string>();
  const agoraIngById = new Map<string, string | null>();
  const ingArr = [...ingredienteIds];
  for (let i = 0; i < ingArr.length; i += 200) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, factor_conversion, unidad_uso, agora_id")
      .in("id", ingArr.slice(i, i + 200));
    if (error) throw new Error(`ventas-dia-promedio: factores — ${error.message}`);
    for (const p of data ?? []) {
      const f = Number(p.factor_conversion);
      factorById.set(p.id as string, Number.isFinite(f) && f > 0 ? f : 1);
      agoraIngById.set(p.id as string, (p.agora_id as string | null) ?? null);
      if (!p.unidad_uso) conversionSinDeclarar.add(p.id as string);
    }
  }

  // ─── Consumo acumulado por producto de almacén ───────────────────────────
  const consumo = new Map<string, number>();
  let lineasSinDestino = 0;
  let ingredientesSinUnidad = 0;
  for (const [productoId, baseQty] of vendidoPorProducto) {
    const receta = recetaByVenta.get(productoId);
    if (receta && receta.length > 0) {
      const agoraVenta = agoraById.get(productoId) ?? null;
      for (const ing of receta) {
        // Un espejo 1:1 (una consumición = una unidad de su gemelo de compra) es seguro
        // aunque no haya conversión declarada: no hay cambio de unidad que hacer.
        const esEspejo =
          ing.cantidad === 1 &&
          agoraVenta !== null &&
          agoraIngById.get(ing.ingredienteId) === agoraVenta;
        if (!esEspejo && conversionSinDeclarar.has(ing.ingredienteId)) {
          // La receta dice "350" pero nadie ha declarado si son gramos o kilos.
          // Calcularlo daría un disparate; se cuenta y se deja a 0.
          ingredientesSinUnidad++;
          continue;
        }
        const factor = factorById.get(ing.ingredienteId) ?? 1;
        const c = (baseQty * ing.cantidad * (1 + ing.mermaPct / 100)) / factor;
        if (c > 0) consumo.set(ing.ingredienteId, (consumo.get(ing.ingredienteId) ?? 0) + c);
      }
      continue;
    }
    // Sin receta: el propio producto si ya es de compra, o su gemelo por agora_id.
    const agoraId = agoraById.get(productoId) ?? null;
    const destino =
      tipoById.get(productoId) === "compra"
        ? productoId
        : agoraId
          ? (compraByAgora.get(agoraId) ?? null)
          : null;
    if (!destino) {
      lineasSinDestino++;
      continue;
    }
    consumo.set(destino, (consumo.get(destino) ?? 0) + baseQty);
  }

  // ─── Persistir: solo lo que cambia ───────────────────────────────────────
  // Se leen TODOS los productos con valor actual distinto de 0 además de los que
  // ahora consumen, para poder bajar a 0 lo que dejó de venderse.
  const { data: actuales, error: errActuales } = await supabase
    .from("productos")
    .select("id, ventas_dia_promedio")
    .eq("empresa_id", empresaId);
  if (errActuales) throw new Error(`ventas-dia-promedio: lectura previa — ${errActuales.message}`);

  let actualizados = 0;
  for (const p of actuales ?? []) {
    const id = p.id as string;
    const nuevo = r3((consumo.get(id) ?? 0) / dias);
    const viejo = r3(Number(p.ventas_dia_promedio ?? 0));
    if (nuevo === viejo) continue;
    const { error } = await supabase
      .from("productos")
      .update({ ventas_dia_promedio: nuevo })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error(`ventas-dia-promedio: update ${id} — ${error.message}`);
    actualizados++;
  }

  return {
    empresaId,
    dias,
    lineas: lineas.length,
    productosConConsumo: [...consumo.values()].filter((v) => v > 0).length,
    actualizados,
    lineasSinDestino,
    ingredientesSinUnidad,
  };
}
