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

// ─── FUNCIÓN DE CONVENIENCIA: descontar por ticket POS ──────────────────────

/**
 * Descuenta stock a partir de un ticket POS cerrado.
 * Carga las líneas del ticket desde BD y delega en `descontarStockPorVentas`.
 *
 * @param signo - 1 descontar (default), -1 revertir (para anulación)
 */
export async function descontarStockPorTicket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  ticketId: string,
  signo: 1 | -1 = 1
): Promise<DescuentoStockOutput> {
  const { data: ticket, error: errTicket } = await supabase
    .from("pos_tickets")
    .select("id, empresa_id, estado, stock_descontado")
    .eq("id", ticketId)
    .single();

  if (errTicket || !ticket) {
    return {
      ingredientesAfectados: 0,
      lineasProcesadas: 0,
      lineasOmitidas: 0,
      errores: [`Ticket ${ticketId} no encontrado: ${errTicket?.message ?? ""}`],
    };
  }

  // Guardia anti-doble-descuento / anti-doble-reversión
  if (signo === 1 && ticket.stock_descontado) {
    return {
      ingredientesAfectados: 0,
      lineasProcesadas: 0,
      lineasOmitidas: 0,
      errores: [`Ticket ${ticketId} ya tenía stock descontado — omitido.`],
    };
  }
  if (signo === -1 && !ticket.stock_descontado) {
    return {
      ingredientesAfectados: 0,
      lineasProcesadas: 0,
      lineasOmitidas: 0,
      errores: [`Ticket ${ticketId} no tenía stock descontado — nada que revertir.`],
    };
  }

  const { data: lineasDb, error: errLineas } = await supabase
    .from("pos_ticket_lineas")
    .select("producto_id, nombre, cantidad")
    .eq("ticket_id", ticketId);

  if (errLineas) {
    return {
      ingredientesAfectados: 0,
      lineasProcesadas: 0,
      lineasOmitidas: 0,
      errores: [`Error cargando líneas del ticket: ${errLineas.message}`],
    };
  }

  const lineas: LineaVentaResuelta[] = (lineasDb ?? [])
    .filter((l) => l.producto_id)
    .map((l) => ({
      productoId: l.producto_id as string,
      nombre: l.nombre ?? "",
      cantidad: Number(l.cantidad ?? 0),
    }));

  const out = await descontarStockPorVentas(supabase, {
    empresaId: ticket.empresa_id,
    lineas,
    signo,
  });

  // Marcar flag sólo si no hubo errores graves (algunas líneas omitidas son aceptables)
  if (out.lineasProcesadas > 0 || lineas.length === 0) {
    await supabase
      .from("pos_tickets")
      .update({ stock_descontado: signo === 1 })
      .eq("id", ticketId);
  }

  return out;
}
