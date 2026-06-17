/**
 * Servicio compartido: descontar (o revertir) stock a partir de ventas.
 *
 * Lo usan:
 *   - Ágora sync  → `src/features/logistica/services/agora-ventas-sync.ts`
 *   - POS propio  → `src/features/sala/pos/actions/tickets-actions.ts` (cierre/anulación)
 *
 * Regla de negocio (confirmada):
 *   - Producto de venta con escandallo → se descuenta cada ingrediente:
 *       consumo = cantidadVendida × cantidadEscandallo × (1 + merma_pct/100)
 *   - Producto de compra sin escandallo → se descuenta el propio producto 1:1.
 *   - Producto de venta sin escandallo  → se omite (no hay forma de descontar).
 *
 * REGLA DE SEGURIDAD: ante error de BD, NO swallow — devolver el error en la lista.
 *   El caller decide si abortar o continuar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  registrarMovimiento,
  revertirMovimientosPorDocumento,
} from "@/features/logistica/services/kardex";

// ─── TIPOS PÚBLICOS ──────────────────────────────────────────────────────────

/**
 * Línea de venta ya resuelta a producto de BD (sin agora_id intermedio).
 * El caller es quien resuelve el mapeo agora_id→productoId si aplica.
 */
export interface LineaVentaResuelta {
  productoId: string;
  nombre: string;
  cantidad: number;
}

export interface DescuentoStockInput {
  empresaId: string;
  lineas: LineaVentaResuelta[];
  /** 1 = descontar (default). -1 = revertir (añadir stock de vuelta). */
  signo?: 1 | -1;
}

export interface DescuentoStockOutput {
  ingredientesAfectados: number;
  lineasProcesadas: number;
  lineasOmitidas: number;
  errores: string[];
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

/**
 * Aplica el delta de stock correspondiente a un conjunto de líneas de venta.
 *
 * @param supabase - Cliente Supabase (normalmente service-role, para evitar RLS en agregaciones).
 */
export async function descontarStockPorVentas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  input: DescuentoStockInput
): Promise<DescuentoStockOutput> {
  const { empresaId, lineas } = input;
  const signo = input.signo ?? 1;
  const errores: string[] = [];
  let lineasProcesadas = 0;
  let lineasOmitidas = 0;
  let ingredientesAfectados = 0;

  if (lineas.length === 0) {
    return { ingredientesAfectados: 0, lineasProcesadas: 0, lineasOmitidas: 0, errores: [] };
  }

  // ─── 1. Cargar productos de la empresa (los que aparecen en las líneas) ──
  const productoIds = Array.from(new Set(lineas.map((l) => l.productoId).filter(Boolean)));

  const { data: productos, error: errProductos } = await supabase
    .from("productos")
    .select("id, nombre, tipo")
    .eq("empresa_id", empresaId)
    .in("id", productoIds);

  if (errProductos) {
    errores.push(`Error cargando productos: ${errProductos.message}`);
    return { ingredientesAfectados, lineasProcesadas, lineasOmitidas, errores };
  }

  const productosById = new Map<string, { id: string; nombre: string; tipo: string }>();
  for (const p of productos ?? []) {
    productosById.set(p.id, { id: p.id, nombre: p.nombre, tipo: p.tipo });
  }

  // ─── 2. Cargar escandallos sólo para los productos de venta involucrados ─
  const productoVentaIds = Array.from(productosById.values())
    .filter((p) => p.tipo === "venta")
    .map((p) => p.id);

  const escandallosPorProducto = new Map<
    string,
    { ingredienteId: string; ingredienteNombre: string; cantidad: number; mermaPct: number }[]
  >();

  if (productoVentaIds.length > 0) {
    const { data: escandallos, error: errEsc } = await supabase
      .from("producto_composicion")
      .select(
        "producto_venta_id, ingrediente_id, cantidad, merma_pct, ingrediente:ingrediente_id(id, nombre)"
      )
      .in("producto_venta_id", productoVentaIds);

    if (errEsc) {
      errores.push(`Error cargando escandallos: ${errEsc.message}`);
      return { ingredientesAfectados, lineasProcesadas, lineasOmitidas, errores };
    }

    for (const e of escandallos ?? []) {
      const ing = (e.ingrediente as unknown) as { id: string; nombre: string } | null;
      const arr = escandallosPorProducto.get(e.producto_venta_id) ?? [];
      arr.push({
        ingredienteId: e.ingrediente_id,
        ingredienteNombre: ing?.nombre ?? "",
        cantidad: Number(e.cantidad ?? 0),
        mermaPct: Number(e.merma_pct ?? 0),
      });
      escandallosPorProducto.set(e.producto_venta_id, arr);
    }
  }

  // ─── 3. Cargar stock actual de la empresa ────────────────────────────────
  const { data: stockRows, error: errStock } = await supabase
    .from("stock")
    .select("id, producto_id, producto_nombre, cantidad_actual")
    .eq("empresa_id", empresaId);

  if (errStock) {
    errores.push(`Error cargando stock: ${errStock.message}`);
    return { ingredientesAfectados, lineasProcesadas, lineasOmitidas, errores };
  }

  const stockByProductoId = new Map<string, { id: string; cantidadActual: number }>();
  for (const s of stockRows ?? []) {
    if (s.producto_id) {
      stockByProductoId.set(s.producto_id, {
        id: s.id,
        cantidadActual: Number(s.cantidad_actual ?? 0),
      });
    }
  }

  // ─── 4. Acumular deltas por stock.id ─────────────────────────────────────
  const now = new Date().toISOString();
  const deltaPorStockId = new Map<string, number>();

  for (const linea of lineas) {
    const producto = productosById.get(linea.productoId);
    if (!producto) {
      lineasOmitidas++;
      errores.push(`Producto id=${linea.productoId} (${linea.nombre}) no existe en empresa ${empresaId}.`);
      continue;
    }

    const escandallos = escandallosPorProducto.get(producto.id);

    if (escandallos && escandallos.length > 0) {
      for (const e of escandallos) {
        const consumo = linea.cantidad * e.cantidad * (1 + e.mermaPct / 100);
        let stockIng = stockByProductoId.get(e.ingredienteId);

        if (!stockIng) {
          // Crear fila de stock si no existe (nuevo ingrediente)
          const { data: newRow, error: errInsert } = await supabase
            .from("stock")
            .insert({
              empresa_id: empresaId,
              producto_id: e.ingredienteId,
              producto_nombre: e.ingredienteNombre,
              cantidad_actual: 0,
              unidad: "ud",
              ultimo_movimiento: now,
            })
            .select("id, cantidad_actual")
            .single();

          if (errInsert || !newRow) {
            errores.push(
              `No se pudo crear stock para "${e.ingredienteNombre}": ${errInsert?.message ?? "error desconocido"}`
            );
            continue;
          }
          stockByProductoId.set(e.ingredienteId, { id: newRow.id, cantidadActual: 0 });
          stockRows?.push({
            id: newRow.id,
            producto_id: e.ingredienteId,
            producto_nombre: e.ingredienteNombre,
            cantidad_actual: 0,
          });
          stockIng = stockByProductoId.get(e.ingredienteId)!;
        }

        deltaPorStockId.set(
          stockIng.id,
          (deltaPorStockId.get(stockIng.id) ?? 0) + signo * consumo
        );
        ingredientesAfectados++;
      }
      lineasProcesadas++;
    } else if (producto.tipo === "compra") {
      const stockProd = stockByProductoId.get(producto.id);
      if (!stockProd) {
        errores.push(`Sin fila de stock para "${producto.nombre}" (compra, sin escandallo).`);
        lineasOmitidas++;
        continue;
      }
      deltaPorStockId.set(
        stockProd.id,
        (deltaPorStockId.get(stockProd.id) ?? 0) + signo * linea.cantidad
      );
      ingredientesAfectados++;
      lineasProcesadas++;
    } else {
      lineasOmitidas++;
      errores.push(`Producto "${producto.nombre}" (venta) sin escandallo — omitido.`);
    }
  }

  // ─── 5. Escribir deltas en BD ────────────────────────────────────────────
  for (const [stockId, delta] of deltaPorStockId.entries()) {
    const fila = stockRows?.find((s) => s.id === stockId);
    const cantidadActual = Number(fila?.cantidad_actual ?? 0);
    const nuevaCantidad = Math.max(0, cantidadActual + delta); // delta ya incluye signo

    const { error: errUpdate } = await supabase
      .from("stock")
      .update({ cantidad_actual: nuevaCantidad, ultimo_movimiento: now })
      .eq("id", stockId);

    if (errUpdate) {
      errores.push(`Error actualizando stock ${stockId}: ${errUpdate.message}`);
    }
  }

  return { ingredientesAfectados, lineasProcesadas, lineasOmitidas, errores };
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

  // Tipo + agora_id de cada producto vendido. El agora_id enlaza el producto de VENTA
  // con su producto de COMPRA (mismo agora_id) = el que lleva el stock. PRP-057.
  const productoIds = Array.from(new Set(lineas.map((l) => l.producto_id)));
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

  for (const l of lineas) {
    const cant = Number(l.cantidad ?? 0);
    // Ágora da el formato de venta: consumo en unidades base = cantidad × ratio.
    const ratio = Number(l.sale_format_ratio ?? 1) || 1;
    const baseQty = cant * ratio;
    const motivo = `Venta: ${l.nombre ?? ""}`.trim();
    const comp = compByVenta.get(l.producto_id);
    try {
      if (comp && comp.length > 0) {
        // Producto COMPUESTO (plato/cóctel): el escandallo de Balles define los ingredientes.
        for (const ing of comp) {
          const factor = factorById.get(ing.ingrediente_id) ?? 1;
          // cantidad del escandallo (unidad de uso) → formato de compra (÷ factor)
          const consumo = (baseQty * ing.cantidad * (1 + ing.merma_pct / 100)) / factor;
          if (consumo <= 0) continue;
          await registrarMovimiento({
            empresaId: ticket.empresa_id,
            productoId: ing.ingrediente_id,
            tipo: "salida",
            cantidad: consumo,
            referencia,
            documentoTipo: "pos_ticket",
            documentoId: ticketId,
            origenLineaId: l.id,
            motivo,
            fecha,
          });
          ingredientesAfectados++;
        }
        lineasProcesadas++;
      } else {
        // SIN escandallo (bebida/1:1): descontar el producto base de compra por el ratio.
        const agoraId = agoraById.get(l.producto_id) ?? null;
        const targetId =
          tipoById.get(l.producto_id) === "compra"
            ? l.producto_id
            : agoraId
              ? compraByAgora.get(agoraId) ?? null
              : null;
        if (!targetId) {
          lineasOmitidas++;
          errores.push(`"${l.nombre}" sin escandallo ni producto de compra equivalente — omitido.`);
          continue;
        }
        if (baseQty > 0) {
          await registrarMovimiento({
            empresaId: ticket.empresa_id,
            productoId: targetId,
            tipo: "salida",
            cantidad: baseQty,
            referencia,
            documentoTipo: "pos_ticket",
            documentoId: ticketId,
            origenLineaId: l.id,
            motivo,
            fecha,
          });
          ingredientesAfectados++;
        }
        lineasProcesadas++;
      }
    } catch (e) {
      errores.push(`Error en línea "${l.nombre}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Marcar el ticket como descontado salvo que no se procesara ninguna línea con datos.
  if (lineasProcesadas > 0 || lineas.length === 0) {
    await supabase.from("pos_tickets").update({ stock_descontado: true }).eq("id", ticketId);
  }

  return { ingredientesAfectados, lineasProcesadas, lineasOmitidas, errores };
}
