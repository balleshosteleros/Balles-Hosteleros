/**
 * Servicio: Ágora tickets → descuento de stock.
 *
 * FLUJO:
 *   1. Fetch GET /api/export/tickets?businessDay=YYYYMMDD  (con api-token header)
 *   2. Resolver cada línea: agora_id → producto_id (BD)
 *   3. Delegar el descuento al servicio compartido `descontarStockPorVentas`
 *      (ver `src/features/sala/pos/services/descontar-stock-por-ventas.ts`)
 *   4. Guardar log en agora_sync_log
 *
 * FORMATO REAL DE ÁGORA (confirmado 2026-04-14):
 *   { "Tickets": [...] }  ← PascalCase en la clave raíz
 *
 * REGLA DE SEGURIDAD ÁGORA (obligatoria):
 *   Ante cualquier error: detener, devolver error exacto, NO swallow.
 */

import { createClient } from "@supabase/supabase-js";
import {
  descontarStockPorVentas,
  type LineaVentaResuelta,
} from "@/features/sala/pos/services/descontar-stock-por-ventas";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // PRP-069: si no viene `fecha` explícita, el día de negocio se calcula en la
  // zona horaria de la EMPRESA, no en la hora local del servidor (que en prod es
  // UTC): cerca de medianoche descargaría el día equivocado de Ágora.
  const tz = await getZonaHorariaEmpresa(supabase, empresaId);
  const businessDay = fechaABusinessDay(fecha, tz);
  const errores: string[] = [];
  let lineasProcesadas = 0;
  let lineasSinMatch = 0;
  let ingredientesDescontados = 0;

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

  // ─── 2. Mapear agora_id → producto_id ────────────────────────────────────
  const { data: productos, error: errProductos } = await supabase
    .from("productos")
    .select("id, nombre, agora_id")
    .eq("empresa_id", empresaId)
    .not("agora_id", "is", null);

  if (errProductos) {
    throw new Error(`Error cargando productos desde BD: ${errProductos.message}`);
  }

  const productosByAgoraId = new Map<string, { id: string; nombre: string }>();
  for (const p of productos ?? []) {
    if (p.agora_id) {
      productosByAgoraId.set(String(p.agora_id).trim(), { id: p.id, nombre: p.nombre });
    }
  }

  const lineasResueltas: LineaVentaResuelta[] = [];
  for (const l of lineasVenta) {
    const producto = productosByAgoraId.get(l.agoraId);
    if (!producto) {
      lineasSinMatch++;
      errores.push(`agora_id "${l.agoraId}" (${l.nombre || "sin nombre"}) sin match en productos.`);
      continue;
    }
    lineasResueltas.push({
      productoId: producto.id,
      nombre: producto.nombre,
      cantidad: l.cantidadVendida,
    });
  }

  // ─── 3. Delegar descuento al servicio compartido ─────────────────────────
  const resultado = await descontarStockPorVentas(supabase, {
    empresaId,
    lineas: lineasResueltas,
    signo: 1,
  });

  lineasProcesadas = resultado.lineasProcesadas;
  lineasSinMatch += resultado.lineasOmitidas;
  ingredientesDescontados = resultado.ingredientesAfectados;
  errores.push(...resultado.errores);

  // ─── 4. Guardar log ───────────────────────────────────────────────────────
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

/**
 * Día de negocio "YYYYMMDD" para Ágora. Si viene `fecha` (ya "YYYY-MM-DD") se
 * respeta. Si no, se computa el día de HOY en la zona horaria de la empresa
 * (PRP-069), no en la hora local del servidor.
 */
function fechaABusinessDay(fecha: string | undefined, tz: string): string {
  const ymd = fecha ? fecha : hoyEnZona(tz); // ambos en formato YYYY-MM-DD
  return ymd.replace(/-/g, "");
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
