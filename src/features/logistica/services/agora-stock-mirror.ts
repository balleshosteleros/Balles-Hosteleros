/**
 * Espejo de stock Ágora → Balles (Opción A, decidida 2026-06-09/10).
 *
 * Ágora es la fuente de verdad del stock: este servicio lee las existencias
 * actuales (`GET /api/export-master/?filter=Stocks`) y las refleja en la tabla
 * `stock` de Balles, empresa a empresa, según el mapa almacén→empresa.
 *
 * POLÍTICA (ver docs/AGORA_INTEGRACION_ESTADO_Y_PLAN.md):
 *   - NO crea productos: el catálogo lo gobierna la curación del Excel
 *     (migración 2026-06-10). Lo que no tenga equivalente se cuenta como omitido.
 *   - NO borra filas de stock ni pisa unidad/cantidad_minima/cantidad_maxima:
 *     actualiza cantidad_actual + ultimo_movimiento de las filas existentes y
 *     solo crea filas nuevas para productos tipo "compra" que aún no tengan.
 *   - Regla de Seguridad Ágora: una sola petición, sin reintentos automáticos;
 *     ante error se registra en agora_sync_log y se devuelve el error exacto.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { AgoraSyncStatus } from "@/features/logistica/types/agora";

// ─── MAPA ALMACÉN ÁGORA → EMPRESA BALLES ─────────────────────────────────────
// Mismo mapeo que la migración del catálogo (scripts/agora/migrar-catalogo.mjs).
// Almacenes Ágora: 1=HABANA FUENLABRADA · 2=almacén 2 · 3=HABANA GETAFE ·
// 4=BACANAL FUENLABRADA · 5=HABANA ALCORCÓN. Getafe/Alcorcón pendientes de alcance.

export const ALMACEN_AGORA_POR_EMPRESA: Record<string, number> = {
  "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47": 4, // BACANAL
  "00000000-0000-0000-0000-000000000001": 1, // HABANA
};

const AGORA_TIMEOUT_MS = 15_000;

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface AgoraStockRow {
  WarehouseId: number;
  ProductId: number;
  Quantity: number;
}

export interface EspejoStockResult {
  success: boolean;
  status: AgoraSyncStatus;
  /** Posiciones de stock que Ágora exporta para el almacén de la empresa. */
  totalRecords: number;
  /** Filas de stock actualizadas + creadas en Balles. */
  okRecords: number;
  errorRecords: number;
  retryCount: number;
  /** Productos con stock en Ágora sin equivalente (o sin fila creable) en Balles. */
  omitidosSinProducto: number;
  errorMessage?: string;
}

// ─── FETCH DE STOCKS DESDE ÁGORA ─────────────────────────────────────────────

/**
 * Descarga las existencias actuales de TODOS los almacenes de Ágora.
 * Una sola petición, con timeout; lanza el error exacto si algo falla.
 */
export async function fetchStocksAgora(): Promise<AgoraStockRow[]> {
  const baseUrl = process.env.AGORA_API_URL;
  const token = process.env.AGORA_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error(
      "AGORA_API_URL o AGORA_API_TOKEN no están configuradas en las variables de entorno."
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGORA_TIMEOUT_MS);

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/export-master/?filter=Stocks`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Api-Token": token, Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Ágora respondió con HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { Stocks?: AgoraStockRow[] };
    if (!Array.isArray(data.Stocks)) {
      throw new Error("Respuesta de Ágora sin el bloque 'Stocks' esperado.");
    }
    return data.Stocks;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Ágora no respondió en ${AGORA_TIMEOUT_MS / 1000}s (timeout).`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── LOG EN agora_sync_log ────────────────────────────────────────────────────

/** Persiste el resultado en agora_sync_log. Si falla, solo console.error. */
async function guardarLogEspejo(
  empresaId: string,
  result: EspejoStockResult,
  createdBy: string | null
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("agora_sync_log").insert({
      empresa_id: empresaId,
      status: result.status,
      total_records: result.totalRecords,
      ok_records: result.okRecords,
      error_records: result.errorRecords,
      retry_count: result.retryCount,
      error_detail: result.errorMessage
        ? [{ registro: null, motivo: result.errorMessage, campo: "espejo-stock" }]
        : null,
      created_by: createdBy,
    });
    if (error) console.error("[agora-stock-mirror] Error guardando sync log:", error.message);
  } catch (err) {
    console.error("[agora-stock-mirror] Error inesperado en guardarLogEspejo:", err);
  }
}

// ─── ESPEJO PARA UNA EMPRESA ─────────────────────────────────────────────────

/**
 * Refleja en Balles el stock de Ágora del almacén asociado a la empresa.
 *
 * @param empresaId - Empresa de Balles (debe estar en ALMACEN_AGORA_POR_EMPRESA)
 * @param createdBy - userId si lo dispara una persona; null si es el cron
 * @param stocksPrefetched - Stocks ya descargados (para no repetir la petición)
 */
export async function espejoStockAgora(
  empresaId: string,
  createdBy: string | null,
  stocksPrefetched?: AgoraStockRow[]
): Promise<EspejoStockResult> {
  const fallo = (errorMessage: string): EspejoStockResult => ({
    success: false,
    status: "error",
    totalRecords: 0,
    okRecords: 0,
    errorRecords: 0,
    retryCount: 0,
    omitidosSinProducto: 0,
    errorMessage,
  });

  const warehouseId = ALMACEN_AGORA_POR_EMPRESA[empresaId];
  if (!warehouseId) {
    return fallo(`La empresa ${empresaId} no tiene almacén de Ágora asociado.`);
  }

  // 1. Stocks de Ágora (una sola petición, sin reintentos)
  let stocks: AgoraStockRow[];
  try {
    stocks = stocksPrefetched ?? (await fetchStocksAgora());
  } catch (err) {
    const result = fallo(err instanceof Error ? err.message : String(err));
    await guardarLogEspejo(empresaId, result, createdBy);
    return result;
  }

  // Cantidad por producto en el almacén de esta empresa (suma de posiciones)
  const cantidadPorAgoraId = new Map<string, number>();
  for (const s of stocks) {
    if (s.WarehouseId !== warehouseId) continue;
    const key = String(s.ProductId);
    cantidadPorAgoraId.set(key, (cantidadPorAgoraId.get(key) ?? 0) + s.Quantity);
  }
  const totalRecords = cantidadPorAgoraId.size;

  const supabase = createAdminClient();

  // 2. Productos de Balles enlazados a Ágora
  const { data: productos, error: errProductos } = await supabase
    .from("productos")
    .select("id, nombre, tipo, agora_id")
    .eq("empresa_id", empresaId)
    .not("agora_id", "is", null)
    .limit(5000);

  if (errProductos) {
    const result = fallo(`Error leyendo productos: ${errProductos.message}`);
    await guardarLogEspejo(empresaId, result, createdBy);
    return result;
  }

  // Un mismo agora_id puede tener DOS filas en Balles (gemelas venta/compra de
  // los "ambos" del Excel). El stock vive en la gemela de COMPRA: preferirla.
  const productoPorAgoraId = new Map<string, NonNullable<typeof productos>[number]>();
  for (const p of productos ?? []) {
    const key = String(p.agora_id);
    const actual = productoPorAgoraId.get(key);
    if (!actual || (actual.tipo !== "compra" && p.tipo === "compra")) {
      productoPorAgoraId.set(key, p);
    }
  }

  // 3. Filas de stock existentes en Balles
  const { data: stockRows, error: errStock } = await supabase
    .from("stock")
    .select("id, producto_id")
    .eq("empresa_id", empresaId)
    .limit(5000);

  if (errStock) {
    const result = fallo(`Error leyendo stock: ${errStock.message}`);
    await guardarLogEspejo(empresaId, result, createdBy);
    return result;
  }

  const stockIdPorProductoId = new Map<string, string>();
  for (const row of stockRows ?? []) {
    if (row.producto_id && !stockIdPorProductoId.has(row.producto_id)) {
      stockIdPorProductoId.set(row.producto_id, row.id);
    }
  }

  // 4. Clasificar: actualizar / crear / omitir
  const ahora = new Date().toISOString();
  const updates: { stockId: string; cantidad: number; nombre: string }[] = [];
  const inserts: Record<string, unknown>[] = [];
  let omitidos = 0;

  for (const [agoraId, cantidad] of cantidadPorAgoraId) {
    const producto = productoPorAgoraId.get(agoraId);
    if (!producto) {
      omitidos++; // sin equivalente en Balles: el catálogo lo gobierna el Excel
      continue;
    }
    const stockId = stockIdPorProductoId.get(producto.id);
    if (stockId) {
      updates.push({ stockId, cantidad, nombre: producto.nombre });
    } else if (producto.tipo === "compra") {
      inserts.push({
        empresa_id: empresaId,
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad_actual: cantidad,
        cantidad_minima: 0,
        cantidad_maxima: 0,
        unidad: "ud",
        ultimo_movimiento: ahora,
      });
    } else {
      omitidos++; // tipo "venta" sin fila previa: no se inventaría (igual que la migración)
    }
  }

  // 5. Ejecutar escrituras (updates en lotes de 20 en paralelo; inserts de 200)
  let okRecords = 0;
  let errorRecords = 0;

  for (let i = 0; i < updates.length; i += 20) {
    const lote = updates.slice(i, i + 20);
    const resultados = await Promise.all(
      lote.map((u) =>
        supabase
          .from("stock")
          .update({ cantidad_actual: u.cantidad, producto_nombre: u.nombre, ultimo_movimiento: ahora })
          .eq("id", u.stockId)
      )
    );
    for (const r of resultados) {
      if (r.error) {
        errorRecords++;
        console.error("[agora-stock-mirror] Error actualizando stock:", r.error.message);
      } else {
        okRecords++;
      }
    }
  }

  for (let i = 0; i < inserts.length; i += 200) {
    const lote = inserts.slice(i, i + 200);
    const { data, error } = await supabase.from("stock").insert(lote).select("id");
    if (error) {
      errorRecords += lote.length;
      console.error("[agora-stock-mirror] Error insertando stock:", error.message);
    } else {
      okRecords += data?.length ?? 0;
    }
  }

  // 6. Resultado + log
  const status: AgoraSyncStatus =
    errorRecords === 0 ? "ok" : okRecords > 0 ? "partial" : "error";

  const result: EspejoStockResult = {
    success: status === "ok" || status === "partial",
    status,
    totalRecords,
    okRecords,
    errorRecords,
    retryCount: 0,
    omitidosSinProducto: omitidos,
    errorMessage:
      errorRecords > 0 ? `${errorRecords} filas de stock no se pudieron escribir.` : undefined,
  };

  await guardarLogEspejo(empresaId, result, createdBy);
  return result;
}

// ─── ESPEJO PARA TODAS LAS EMPRESAS MAPEADAS ─────────────────────────────────

/**
 * Ejecuta el espejo para todas las empresas del mapa almacén→empresa,
 * descargando los stocks de Ágora UNA sola vez. Usado por el cron diario.
 */
export async function espejoStockAgoraTodas(
  createdBy: string | null = null
): Promise<{ ok: boolean; resultados: ({ empresaId: string } & EspejoStockResult)[] }> {
  let stocks: AgoraStockRow[];
  try {
    stocks = await fetchStocksAgora();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const resultados = [];
    for (const empresaId of Object.keys(ALMACEN_AGORA_POR_EMPRESA)) {
      const result: EspejoStockResult = {
        success: false,
        status: "error",
        totalRecords: 0,
        okRecords: 0,
        errorRecords: 0,
        retryCount: 0,
        omitidosSinProducto: 0,
        errorMessage,
      };
      await guardarLogEspejo(empresaId, result, createdBy);
      resultados.push({ empresaId, ...result });
    }
    return { ok: false, resultados };
  }

  const resultados = [];
  let ok = true;
  for (const empresaId of Object.keys(ALMACEN_AGORA_POR_EMPRESA)) {
    const result = await espejoStockAgora(empresaId, createdBy, stocks);
    if (!result.success) ok = false;
    resultados.push({ empresaId, ...result });
  }
  return { ok, resultados };
}
