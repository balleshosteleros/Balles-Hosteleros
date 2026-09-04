/**
 * Servicio: descontar (o revertir) stock a partir de las ventas de un ticket,
 * SIEMPRE por el kardex (PRP-057).
 *
 * ORIGEN ÚNICO DE VERDAD: `pos_ticket_lineas`. Las ventas de Ágora las escribe ahí
 * la ingesta diaria (`agora-ventas-ingesta.ts`); el POS propio escribe sus tickets
 * igual. El descuento NO llama nunca a la API del TPV: lee de la tabla.
 *
 * Lo usan:
 *   - POS propio → `src/features/sala/pos/actions/tickets-actions.ts` (cierre/anulación)
 *   - Ágora      → `src/features/logistica/services/agora-descuento-dia.ts` (cron y reproceso)
 *
 * Regla de negocio (confirmada):
 *   - Producto de venta con escandallo → se descuenta cada ingrediente:
 *       consumo = cantidadVendida × cantidadEscandallo × (1 + merma_pct/100)
 *   - Producto de compra sin escandallo → se descuenta el propio producto 1:1.
 *   - Producto de venta sin escandallo  → se omite (no hay forma de descontar).
 *
 * REGLA DE SEGURIDAD: ante error de BD, NO swallow — devolver el error en la lista.
 *   El caller decide si abortar o continuar.
 *
 * ⚠️ Aquí VIVÍA un segundo motor (`descontarStockPorVentas`) que escribía
 * `stock.cantidad_actual` a pelo, sin kardex, sin idempotencia, clampando a 0 y
 * saltándose `controla_stock`. Se retiró el 03-sep junto con el camino de Ágora que
 * lo usaba: dos motores de descuento con reglas distintas es exactamente cómo se
 * descuadra un almacén sin que nadie lo note. No lo reintroduzcas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  registrarMovimiento,
  revertirMovimientosPorDocumento,
} from "@/features/logistica/services/kardex";

// ─── TIPOS PÚBLICOS ──────────────────────────────────────────────────────────

export interface DescuentoStockOutput {
  ingredientesAfectados: number;
  lineasProcesadas: number;
  lineasOmitidas: number;
  errores: string[];
}

// ─── FUNCIÓN DE CONVENIENCIA: descontar por ticket POS/Ágora (vía KARDEX) ────

/**
 * Descuenta (o revierte) el stock de un ticket POS/Ágora a través del KARDEX (PRP-057).
 *
 * Cada ingrediente consumido genera un movimiento `salida` en `stock_movimientos`
 * con la referencia a la factura (`numero`, p. ej. "AG-A-1043") y a la línea de venta
 * (`origen_linea_id`), de modo que cada `-1` es rastreable hasta su factura. El saldo
 * de `stock.cantidad_actual` se mantiene materializado por el propio kardex.
 *
 *   - Producto de venta con escandallo (`producto_composicion`) → un movimiento por
 *     ingrediente: consumo = cantidadVendida × cantidadReceta × (1 + merma/100).
 *   - Producto de compra vendido directo (sin escandallo) → movimiento 1:1 sobre sí mismo.
 *   - Producto de venta sin escandallo → se omite (pendiente de dar de alta su receta).
 *
 * Idempotente por `(origen_linea_id, producto_id)` en el kardex + guardia `stock_descontado`.
 *
 * @param signo - 1 descontar (default), -1 revertir (anulación / reproceso del día).
 */
export async function descontarStockPorTicket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  ticketId: string,
  signo: 1 | -1 = 1
): Promise<DescuentoStockOutput> {
  const vacio = (errores: string[]): DescuentoStockOutput => ({
    ingredientesAfectados: 0,
    lineasProcesadas: 0,
    lineasOmitidas: 0,
    errores,
  });

  const { data: ticket, error: errTicket } = await supabase
    .from("pos_tickets")
    .select("id, empresa_id, numero, estado, stock_descontado, cerrado_at")
    .eq("id", ticketId)
    .single();

  if (errTicket || !ticket) {
    return vacio([`Ticket ${ticketId} no encontrado: ${errTicket?.message ?? ""}`]);
  }

  // ─── Reversión: deshacer TODOS los movimientos del ticket ────────────────
  if (signo === -1) {
    if (!ticket.stock_descontado) {
      return vacio([`Ticket ${ticketId} no tenía stock descontado — nada que revertir.`]);
    }
    const { revertidos } = await revertirMovimientosPorDocumento({
      empresaId: ticket.empresa_id,
      documentoTipo: "pos_ticket",
      documentoId: ticketId,
    });
    await supabase.from("pos_tickets").update({ stock_descontado: false }).eq("id", ticketId);
    return { ingredientesAfectados: revertidos, lineasProcesadas: 0, lineasOmitidas: 0, errores: [] };
  }

  // ─── Descuento ───────────────────────────────────────────────────────────
  if (ticket.stock_descontado) {
    return vacio([`Ticket ${ticketId} ya tenía stock descontado — omitido.`]);
  }

  const { data: lineasDb, error: errLineas } = await supabase
    .from("pos_ticket_lineas")
    .select("id, producto_id, nombre, cantidad, sale_format_ratio")
    .eq("ticket_id", ticketId);

  if (errLineas) {
    return vacio([`Error cargando líneas del ticket: ${errLineas.message}`]);
  }

  const lineas = (lineasDb ?? []).filter((l) => l.producto_id) as {
    id: string;
    producto_id: string;
    nombre: string | null;
    cantidad: number | null;
    sale_format_ratio: number | null;
  }[];

  // COMPLEMENTOS de cada línea (sabor de la shisha, cápsula del café, guarnición,
  // refresco del combinado). Son mercancía que sale del almacén igual que la línea
  // principal: si no se descuentan, se descuenta el plato pero no su guarnición y el
  // almacén descuadra pareciendo que el sistema funciona.
  const { data: addinsDb } = await supabase
    .from("pos_ticket_linea_addins")
    .select("id, linea_id, producto_id, nombre, ratio")
    .in("linea_id", lineas.length > 0 ? lineas.map((l) => l.id) : ["00000000-0000-0000-0000-000000000000"]);

  const addins = (addinsDb ?? []) as {
    id: string;
    linea_id: string;
    producto_id: string | null;
    nombre: string | null;
    ratio: number | null;
  }[];
  const cantidadPorLinea = new Map(lineas.map((l) => [l.id, Number(l.cantidad ?? 0)]));

  // Tipo + agora_id de cada producto vendido. El agora_id enlaza el producto de VENTA
  // con su producto de COMPRA (mismo agora_id) = el que lleva el stock. PRP-057.
  // Incluye los productos de los complementos: se resuelven igual que una línea.
  const productoIds = Array.from(
    new Set([
      ...lineas.map((l) => l.producto_id),
      ...addins.map((a) => a.producto_id).filter(Boolean) as string[],
    ]),
  );
  const tipoById = new Map<string, string>();
  const agoraById = new Map<string, string | null>();
  const agoraIds = new Set<string>();
  if (productoIds.length > 0) {
    const { data: productos } = await supabase
      .from("productos")
      .select("id, tipo, agora_id")
      .eq("empresa_id", ticket.empresa_id)
      .in("id", productoIds);
    for (const p of productos ?? []) {
      tipoById.set(p.id, p.tipo);
      agoraById.set(p.id, (p.agora_id as string | null) ?? null);
      if (p.agora_id) agoraIds.add(p.agora_id as string);
    }
  }

  // Producto de COMPRA (stock) por agora_id, para bebidas sin escandallo (formato → base).
  const compraByAgora = new Map<string, string>();
  if (agoraIds.size > 0) {
    const ids = Array.from(agoraIds);
    for (let i = 0; i < ids.length; i += 200) {
      const { data: compras } = await supabase
        .from("productos")
        .select("id, agora_id")
        .eq("empresa_id", ticket.empresa_id)
        .eq("tipo", "compra")
        .in("agora_id", ids.slice(i, i + 200));
      for (const p of compras ?? []) if (p.agora_id) compraByAgora.set(p.agora_id as string, p.id as string);
    }
  }

  // Escandallos (producto_composicion) de los productos de venta vendidos.
  const ventaIds = productoIds.filter((id) => tipoById.get(id) === "venta");
  const compByVenta = new Map<
    string,
    { ingrediente_id: string; cantidad: number; merma_pct: number }[]
  >();
  if (ventaIds.length > 0) {
    const { data: comp } = await supabase
      .from("producto_composicion")
      .select("producto_venta_id, ingrediente_id, cantidad, merma_pct")
      .in("producto_venta_id", ventaIds);
    for (const c of comp ?? []) {
      const arr = compByVenta.get(c.producto_venta_id) ?? [];
      arr.push({
        ingrediente_id: c.ingrediente_id,
        cantidad: Number(c.cantidad ?? 0),
        merma_pct: Number(c.merma_pct ?? 0),
      });
      compByVenta.set(c.producto_venta_id, arr);
    }
  }

  // Factor de conversión de cada ingrediente: el escandallo guarda la cantidad en
  // unidad de uso (cl, g, ud) y el stock se cuenta en el formato de compra (botella,
  // barril, kg). consumo_en_stock = cantidad_uso / factor_conversion. PRP-057.
  const factorById = new Map<string, number>();
  const ingredienteIds = new Set<string>();
  for (const arr of compByVenta.values()) for (const c of arr) ingredienteIds.add(c.ingrediente_id);
  if (ingredienteIds.size > 0) {
    const ids = Array.from(ingredienteIds);
    for (let i = 0; i < ids.length; i += 200) {
      const { data: facs } = await supabase
        .from("productos")
        .select("id, factor_conversion")
        .in("id", ids.slice(i, i + 200));
      for (const p of facs ?? []) {
        const f = Number(p.factor_conversion);
        factorById.set(p.id, Number.isFinite(f) && f > 0 ? f : 1);
      }
    }
  }

  const referencia = (ticket.numero as string | null) ?? null;
  const fecha = (ticket.cerrado_at as string | null) ?? undefined;
  const errores: string[] = [];
  let lineasProcesadas = 0;
  let lineasOmitidas = 0;
  let ingredientesAfectados = 0;

  /**
   * Aplica el consumo de UN concepto vendido (una línea o uno de sus complementos).
   * Es la misma álgebra para los dos: con escandallo se expanden los ingredientes,
   * sin él se descuenta el producto de compra 1:1. Se comparte a propósito — dos
   * copias divergirían en semanas.
   *
   * `origenLineaId` identifica el consumo en el kardex y por eso cada complemento
   * lleva el SUYO (su propia fila), no el de su línea padre: el índice único
   * (origen_linea_id, producto_id) haría colisionar un plato y un complemento que
   * consuman el mismo producto.
   */
  const aplicarConsumo = async (args: {
    productoId: string;
    baseQty: number;
    origenLineaId: string;
    motivo: string;
    etiqueta: string;
  }): Promise<{ movimientos: number; omitido: boolean }> => {
    const comp = compByVenta.get(args.productoId);
    if (comp && comp.length > 0) {
      let n = 0;
      for (const ing of comp) {
        const factor = factorById.get(ing.ingrediente_id) ?? 1;
        // cantidad del escandallo (unidad de uso) → formato de compra (÷ factor)
        const consumo = (args.baseQty * ing.cantidad * (1 + ing.merma_pct / 100)) / factor;
        if (consumo <= 0) continue;
        await registrarMovimiento({
          empresaId: ticket.empresa_id,
          productoId: ing.ingrediente_id,
          tipo: "salida",
          cantidad: consumo,
          referencia,
          documentoTipo: "pos_ticket",
          documentoId: ticketId,
          origenLineaId: args.origenLineaId,
          motivo: args.motivo,
          fecha,
        });
        n++;
      }
      return { movimientos: n, omitido: false };
    }
    // SIN escandallo (bebida/1:1): descontar el producto base de compra.
    const agoraId = agoraById.get(args.productoId) ?? null;
    const targetId =
      tipoById.get(args.productoId) === "compra"
        ? args.productoId
        : agoraId
          ? compraByAgora.get(agoraId) ?? null
          : null;
    if (!targetId) {
      errores.push(`${args.etiqueta} sin escandallo ni producto de compra equivalente — omitido.`);
      return { movimientos: 0, omitido: true };
    }
    if (args.baseQty <= 0) return { movimientos: 0, omitido: false };
    await registrarMovimiento({
      empresaId: ticket.empresa_id,
      productoId: targetId,
      tipo: "salida",
      cantidad: args.baseQty,
      referencia,
      documentoTipo: "pos_ticket",
      documentoId: ticketId,
      origenLineaId: args.origenLineaId,
      motivo: args.motivo,
      fecha,
    });
    return { movimientos: 1, omitido: false };
  };

  for (const l of lineas) {
    const cant = Number(l.cantidad ?? 0);
    // Ágora da el formato de venta: consumo en unidades base = cantidad × ratio.
    const ratio = Number(l.sale_format_ratio ?? 1) || 1;
    const baseQty = cant * ratio;
    const motivo = `Venta: ${l.nombre ?? ""}`.trim();
    try {
      const r = await aplicarConsumo({
        productoId: l.producto_id,
        baseQty,
        origenLineaId: l.id,
        motivo,
        etiqueta: `"${l.nombre}"`,
      });
      ingredientesAfectados += r.movimientos;
      if (r.omitido) lineasOmitidas++;
      else lineasProcesadas++;
    } catch (e) {
      errores.push(`Error en línea "${l.nombre}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── Complementos ────────────────────────────────────────────────────────
  // Consumen en proporción a la línea que los lleva: 1 shisha × ratio 0,009 = 0,009 kg
  // de ese tabaco. HOY el ratio lo dicta el TPV, que es el único sitio donde ese dato
  // existe. Cuando se construyan los formatos de venta (DECISIÓN 6-BIS), la
  // configuración de Balles pasará a mandar y este ratio quedará como respaldo.
  for (const a of addins) {
    if (!a.producto_id) {
      // Llegó un complemento que no casa con ningún producto de Balles: se avisa en
      // vez de tragárselo, porque su consumo se está perdiendo.
      errores.push(`Complemento "${a.nombre}" sin producto enlazado — no se descuenta.`);
      continue;
    }
    const baseQty = (cantidadPorLinea.get(a.linea_id) ?? 0) * (Number(a.ratio ?? 1) || 1);
    try {
      const r = await aplicarConsumo({
        productoId: a.producto_id,
        baseQty,
        origenLineaId: a.id,
        motivo: `Venta (complemento): ${a.nombre ?? ""}`.trim(),
        etiqueta: `Complemento "${a.nombre}"`,
      });
      ingredientesAfectados += r.movimientos;
    } catch (e) {
      errores.push(`Error en complemento "${a.nombre}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Marcar el ticket como descontado salvo que no se procesara ninguna línea con datos.
  if (lineasProcesadas > 0 || lineas.length === 0) {
    await supabase.from("pos_tickets").update({ stock_descontado: true }).eq("id", ticketId);
  }

  return { ingredientesAfectados, lineasProcesadas, lineasOmitidas, errores };
}
