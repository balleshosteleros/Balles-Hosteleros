/**
 * Servicio: Ágora tickets → descuento de stock.
 *
 * FLUJO:
 *   1. Fetch GET /api/export/tickets?businessDay=YYYYMMDD  (con api-token header)
 *   2. Por cada línea vendida:
 *      a. Buscar producto en BD por agora_id
 *      b. Si tiene escandallo → descontar cada ingrediente del stock
 *         consumo = cantidad_vendida × cantidad_escandallo × (1 + merma_pct/100)
 *      c. Si no tiene escandallo y tipo='compra' → descontar producto directamente
 *   3. Log en agora_sync_log
 *
 * FORMATO REAL DE ÁGORA (confirmado 2026-04-14):
 *   { "Tickets": [...] }  ← PascalCase en la clave raíz
 *   Dentro de cada ticket se espera PascalCase: Lines, ProductId, Quantity, Name
 *   Se acepta también camelCase como fallback por compatibilidad futura.
 *
 * REGLA DE SEGURIDAD ÁGORA (obligatoria):
 *   Ante cualquier error: detener, devolver error exacto, NO swallow.
 */

import { createClient } from "@supabase/supabase-js";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const AGORA_TIMEOUT_MS = 15_000;

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface LineaVenta {
  agoraId: string;
  nombre: string;
  cantidadVendida: number;
}

export interface DescuentoStockResult {
  success: boolean;
  businessDay: string;
  totalLineas: number;
  lineasProcesadas: number;
  lineasSinMatch: number;
  ingredientesDescontados: number;
  errores: string[];
  errorDetail?: unknown;
}

// ─── EXTRACCIÓN FLEXIBLE DE CAMPOS ───────────────────────────────────────────
// Ágora usa PascalCase; aceptamos también camelCase y snake_case como fallback.

type AnyRecord = Record<string, unknown>;

function getString(obj: AnyRecord, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return String(v).trim();
  }
  return null;
}

function getNumber(obj: AnyRecord, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function getArray(obj: AnyRecord, ...keys: string[]): AnyRecord[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v as AnyRecord[];
  }
  return [];
}

/** Extrae el agora_id de una línea de ticket. PascalCase primero. */
function extraerAgoraId(linea: AnyRecord): string | null {
  return getString(
    linea,
    "ProductId",   // Ágora PascalCase
    "productId",   // camelCase fallback
    "idProducto",  // español fallback
    "codProducto",
    "Id",
    "id",
    "Code",
    "code",
  );
}

/** Extrae la cantidad vendida de una línea de ticket. PascalCase primero. */
function extraerCantidad(linea: AnyRecord): number {
  const n = getNumber(
    linea,
    "Quantity",    // Ágora PascalCase
    "quantity",
    "Qty",
    "qty",
    "cantidad",
    "Amount",
    "amount",
    "Units",
    "units",
  );
  return n !== null ? Math.abs(n) : 0;
}

/** Extrae el nombre del producto de una línea (solo para logs). */
function extraerNombre(linea: AnyRecord): string {
  return getString(
    linea,
    "Name",         // Ágora PascalCase
    "ProductName",
    "name",
    "productName",
    "nombre",
    "nombreProducto",
    "Description",
    "description",
  ) ?? "";
}

/** Extrae las líneas de un ticket. PascalCase primero. */
function extraerLineas(ticket: AnyRecord): AnyRecord[] {
  return getArray(
    ticket,
    "Lines",    // Ágora PascalCase
    "lines",
    "Items",
    "items",
    "Lineas",
    "lineas",
    "Details",
    "details",
    "Detalles",
    "detalles",
  );
}

/** Normaliza la respuesta de Ágora a un array de tickets (PascalCase + fallbacks). */
function normalizarRespuesta(raw: unknown): AnyRecord[] {
  if (Array.isArray(raw)) return raw as AnyRecord[];
  if (raw && typeof raw === "object") {
    const obj = raw as AnyRecord;
    // PascalCase: {"Tickets": [...]}
    const arr = getArray(obj, "Tickets", "tickets", "Data", "data", "Results", "results");
    if (arr.length > 0 || "Tickets" in obj || "tickets" in obj) return arr;
  }
  return [];
}

// ─── FETCH TICKETS DE ÁGORA ───────────────────────────────────────────────────

async function fetchTicketsAgora(
  businessDay: string,
  agoraUrl: string,
  agoraToken: string
): Promise<{ lineas: LineaVenta[]; rawMuestra: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGORA_TIMEOUT_MS);

  try {
    const url = `${agoraUrl}/api/export/tickets?businessDay=${businessDay}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "api-token": agoraToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Ágora respondió HTTP ${response.status}: ${response.statusText}`);
    }

    const rawText = await response.text();
    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch {
      throw new Error(`Ágora devolvió respuesta no-JSON: ${rawText.slice(0, 200)}`);
    }

    const tickets = normalizarRespuesta(raw);

    // Log muestra del primer ticket (para debugging de formato)
    const rawMuestra = tickets.length > 0
      ? { primerTicket: tickets[0], totalTickets: tickets.length }
      : { respuestaCompleta: raw };

    // Agregar por agora_id (suma de cantidades en todos los tickets del día)
    const agregado = new Map<string, { nombre: string; cantidad: number }>();

    for (const ticket of tickets) {
      const lineas = extraerLineas(ticket);
      for (const linea of lineas) {
        const agoraId = extraerAgoraId(linea);
        if (!agoraId) continue;
        const cantidad = extraerCantidad(linea);
        if (cantidad <= 0) continue;
        const nombre = extraerNombre(linea);
        const prev = agregado.get(agoraId);
        if (prev) {
          prev.cantidad += cantidad;
        } else {
          agregado.set(agoraId, { nombre, cantidad });
        }
      }
    }

    const lineas = Array.from(agregado.entries()).map(([agoraId, v]) => ({
      agoraId,
      nombre: v.nombre,
      cantidadVendida: v.cantidad,
    }));

    return { lineas, rawMuestra };
  } finally {
    clearTimeout(timer);
  }
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * Descuenta stock según ventas del día en Ágora POS.
 *
 * @param empresaId  - UUID de la empresa
 * @param userId     - UUID del usuario que lanza la sync (para log)
 * @param fecha      - YYYY-MM-DD o undefined para hoy
 */
export async function descontarStockPorVentasAgora(
  empresaId: string,
  userId: string | null,
  fecha?: string
): Promise<DescuentoStockResult> {
  const agoraUrl = process.env.AGORA_API_URL;
  const agoraToken = process.env.AGORA_API_TOKEN;

  if (!agoraUrl || !agoraToken) {
    throw new Error(
      "AGORA_API_URL o AGORA_API_TOKEN no están configuradas en las variables de entorno."
    );
  }

  const businessDay = fechaABusinessDay(fecha);
  const errores: string[] = [];
  let lineasProcesadas = 0;
  let lineasSinMatch = 0;
  let ingredientesDescontados = 0;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ─── 1. Fetch tickets ────────────────────────────────────────────────────
  let lineasVenta: LineaVenta[];
  let rawMuestra: unknown;
  try {
    const resultado = await fetchTicketsAgora(businessDay, agoraUrl, agoraToken);
    lineasVenta = resultado.lineas;
    rawMuestra = resultado.rawMuestra;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Error al obtener tickets de Ágora (${businessDay}): ${msg}`);
  }

  // Log del formato raw (solo si hay datos — para diagnóstico en producción)
  if (lineasVenta.length > 0) {
    console.log("[agora-ventas-sync] Formato respuesta Ágora:", JSON.stringify(rawMuestra, null, 2));
    console.log(`[agora-ventas-sync] ${businessDay}: ${lineasVenta.length} productos vendidos`);
  } else {
    console.log(`[agora-ventas-sync] ${businessDay}: sin ventas registradas. Raw:`, JSON.stringify(rawMuestra));
  }

  if (lineasVenta.length === 0) {
    await guardarLogDescuento(supabase, {
      empresaId,
      userId,
      businessDay,
      status: "ok",
      totalLineas: 0,
      lineasProcesadas: 0,
      errores: [],
    });
    return {
      success: true,
      businessDay,
      totalLineas: 0,
      lineasProcesadas: 0,
      lineasSinMatch: 0,
      ingredientesDescontados: 0,
      errores: [],
    };
  }

  // ─── 2. Cargar catálogo de productos de la empresa ────────────────────────
  const { data: productos, error: errProductos } = await supabase
    .from("productos")
    .select("id, nombre, tipo, agora_id")
    .eq("empresa_id", empresaId)
    .not("agora_id", "is", null);

  if (errProductos) {
    throw new Error(`Error cargando productos desde BD: ${errProductos.message}`);
  }

  const productosByAgoraId = new Map<string, { id: string; nombre: string; tipo: string }>();
  for (const p of productos ?? []) {
    if (p.agora_id) {
      productosByAgoraId.set(String(p.agora_id).trim(), {
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
      });
    }
  }

  // ─── 3. Cargar todos los escandallos de la empresa ────────────────────────
  const productoVentaIds = Array.from(productosByAgoraId.values())
    .filter((p) => p.tipo === "venta")
    .map((p) => p.id);

  const escandallosPorProducto = new Map<
    string,
    { ingredienteId: string; ingredienteNombre: string; cantidad: number; mermaPct: number }[]
  >();

  if (productoVentaIds.length > 0) {
    const { data: escandallos, error: errEsc } = await supabase
      .from("escandallos")
      .select(
        "producto_venta_id, ingrediente_id, cantidad, merma_pct, ingrediente:ingrediente_id(id, nombre)"
      )
      .in("producto_venta_id", productoVentaIds);

    if (errEsc) {
      throw new Error(`Error cargando escandallos desde BD: ${errEsc.message}`);
    }

    for (const e of escandallos ?? []) {
      const ing = (e.ingrediente as unknown) as { id: string; nombre: string } | null;
      const lineas = escandallosPorProducto.get(e.producto_venta_id) ?? [];
      lineas.push({
        ingredienteId: e.ingrediente_id,
        ingredienteNombre: ing?.nombre ?? "",
        cantidad: Number(e.cantidad ?? 0),
        mermaPct: Number(e.merma_pct ?? 0),
      });
      escandallosPorProducto.set(e.producto_venta_id, lineas);
    }
  }

  // ─── 4. Cargar stock actual ───────────────────────────────────────────────
  const { data: stockRows, error: errStock } = await supabase
    .from("stock")
    .select("id, producto_id, producto_nombre, cantidad_actual")
    .eq("empresa_id", empresaId);

  if (errStock) {
    throw new Error(`Error cargando stock desde BD: ${errStock.message}`);
  }

  const stockByProductoId = new Map<string, { id: string; cantidad_actual: number }>();
  for (const s of stockRows ?? []) {
    if (s.producto_id) {
      stockByProductoId.set(s.producto_id, {
        id: s.id,
        cantidad_actual: Number(s.cantidad_actual ?? 0),
      });
    }
  }

  // ─── 5. Calcular y acumular descuentos ───────────────────────────────────
  const now = new Date().toISOString();
  const descuentosAcumulados = new Map<string, number>();

  for (const linea of lineasVenta) {
    const producto = productosByAgoraId.get(linea.agoraId);

    if (!producto) {
      lineasSinMatch++;
      errores.push(`agora_id "${linea.agoraId}" (${linea.nombre || "sin nombre"}) sin match en productos.`);
      continue;
    }

    const escandallos = escandallosPorProducto.get(producto.id);

    if (escandallos && escandallos.length > 0) {
      // Producto de venta con escandallo → descontar ingredientes
      for (const e of escandallos) {
        const consumo = linea.cantidadVendida * e.cantidad * (1 + e.mermaPct / 100);
        const stockIng = stockByProductoId.get(e.ingredienteId);

        if (!stockIng) {
          // Crear fila de stock si no existe (nuevo ingrediente añadido después de la migración)
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
              `Sin stock para ingrediente "${e.ingredienteNombre}" y no se pudo crear: ${errInsert?.message ?? "error desconocido"}`
            );
            continue;
          }
          // Añadir al índice local para esta ejecución
          stockByProductoId.set(e.ingredienteId, { id: newRow.id, cantidad_actual: 0 });
          stockRows?.push({ id: newRow.id, producto_id: e.ingredienteId, producto_nombre: e.ingredienteNombre, cantidad_actual: 0 });
          const stockIngNew = stockByProductoId.get(e.ingredienteId)!;
          descuentosAcumulados.set(
            stockIngNew.id,
            (descuentosAcumulados.get(stockIngNew.id) ?? 0) + consumo
          );
          ingredientesDescontados++;
          continue;
        }

        descuentosAcumulados.set(
          stockIng.id,
          (descuentosAcumulados.get(stockIng.id) ?? 0) + consumo
        );
        ingredientesDescontados++;
      }
      lineasProcesadas++;
    } else if (producto.tipo === "compra") {
      // Sin escandallo, producto de compra → descontar directamente
      const stockProd = stockByProductoId.get(producto.id);
      if (!stockProd) {
        errores.push(`Sin fila de stock para producto "${producto.nombre}" (compra, sin escandallo).`);
        lineasSinMatch++;
        continue;
      }
      descuentosAcumulados.set(
        stockProd.id,
        (descuentosAcumulados.get(stockProd.id) ?? 0) + linea.cantidadVendida
      );
      ingredientesDescontados++;
      lineasProcesadas++;
    } else {
      // Producto de venta sin escandallo → no se puede descontar
      lineasSinMatch++;
      errores.push(
        `Producto "${producto.nombre}" (venta, agora_id=${linea.agoraId}) sin escandallo — omitido.`
      );
    }
  }

  // ─── 6. Escribir descuentos en BD ────────────────────────────────────────
  for (const [stockId, totalDescontar] of descuentosAcumulados.entries()) {
    const stockActual = stockRows?.find((s) => s.id === stockId);
    const cantidadActual = Number(stockActual?.cantidad_actual ?? 0);
    const nuevaCantidad = Math.max(0, cantidadActual - totalDescontar);

    const { error: errUpdate } = await supabase
      .from("stock")
      .update({ cantidad_actual: nuevaCantidad, ultimo_movimiento: now })
      .eq("id", stockId);

    if (errUpdate) {
      errores.push(`Error actualizando stock ${stockId}: ${errUpdate.message}`);
    }
  }

  // ─── 7. Guardar log ───────────────────────────────────────────────────────
  const status = errores.length === 0 ? "ok" : lineasProcesadas > 0 ? "partial" : "error";

  await guardarLogDescuento(supabase, {
    empresaId,
    userId,
    businessDay,
    status,
    totalLineas: lineasVenta.length,
    lineasProcesadas,
    errores,
  });

  return {
    success: status !== "error",
    businessDay,
    totalLineas: lineasVenta.length,
    lineasProcesadas,
    lineasSinMatch,
    ingredientesDescontados,
    errores,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fechaABusinessDay(fecha?: string): string {
  const d = fecha ? new Date(fecha) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function guardarLogDescuento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: {
    empresaId: string;
    userId: string | null;
    businessDay: string;
    status: string;
    totalLineas: number;
    lineasProcesadas: number;
    errores: string[];
  }
) {
  try {
    await supabase.from("agora_sync_log").insert({
      empresa_id: opts.empresaId,
      status: opts.status,
      total_records: opts.totalLineas,
      ok_records: opts.lineasProcesadas,
      error_records: opts.errores.length,
      retry_count: 0,
      error_detail:
        opts.errores.length > 0
          ? opts.errores.map((e) => ({ motivo: e }))
          : null,
      created_by: opts.userId ?? null,
    });
  } catch (err) {
    console.error("[agora-ventas-sync] Error guardando log:", err);
  }
}
