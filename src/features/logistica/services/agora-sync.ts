/**
 * Servicio de sincronización con Ágora POS.
 *
 * ARQUITECTURA:
 *   - Este archivo es independiente de run-ingest.ts (ingesta one-shot).
 *   - Toda escritura en BD pasa por validarLoteAgora() primero.
 *   - Ante cualquier error: NO reintenta solo — cumple Regla Seguridad Ágora.
 *
 * REGLA DE SEGURIDAD ÁGORA (obligatoria):
 *   Ante timeout, error de red o datos corruptos:
 *   1. Detener proceso
 *   2. Registrar en agora_sync_log con status="timeout" o "error"
 *   3. Devolver error exacto al caller (no swallowing)
 *   4. El caller (server action) muestra el error al usuario y pide aprobación
 *
 * VARIABLE DE ENTORNO:
 *   AGORA_API_URL — URL del endpoint de Ágora (no hardcodear nunca)
 */

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import {
  validarLoteAgora,
  type AgoraBatchResult,
  type AgoraSyncLogEntry,
  type AgoraSyncStatus,
} from "@/features/logistica/types/agora";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const AGORA_TIMEOUT_MS = 10_000; // 10 segundos
const MAX_REINTENTOS = 3;

// ─── TIPOS INTERNOS ───────────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  status: AgoraSyncStatus;
  totalRecords: number;
  okRecords: number;
  errorRecords: number;
  retryCount: number;
  errorMessage?: string;
  errorDetail?: AgoraBatchResult["errores"];
}

// ─── FETCH CON TIMEOUT ────────────────────────────────────────────────────────

/**
 * Llama al endpoint de Ágora con timeout configurable.
 * Lanza AbortError si supera AGORA_TIMEOUT_MS.
 */
async function fetchAgoraConTimeout(url: string): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGORA_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Ágora respondió con HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  } finally {
    clearTimeout(timer);
  }
}

// ─── GUARDAR LOG EN BD ────────────────────────────────────────────────────────

/**
 * Persiste el resultado de un sync en agora_sync_log.
 * No lanza excepción: si falla el log, solo hace console.error.
 */
async function guardarSyncLog(entry: AgoraSyncLogEntry): Promise<void> {
  try {
    const { supabase } = await getLogisticaContext();
    const { error } = await supabase.from("agora_sync_log").insert({
      empresa_id: entry.empresa_id,
      status: entry.status,
      total_records: entry.total_records,
      ok_records: entry.ok_records,
      error_records: entry.error_records,
      retry_count: entry.retry_count,
      error_detail: entry.error_detail ?? null,
      created_by: entry.created_by ?? null,
    });

    if (error) {
      console.error("[agora-sync] Error guardando sync log:", error.message);
    }
  } catch (err) {
    console.error("[agora-sync] Error inesperado en guardarSyncLog:", err);
  }
}

// ─── UPSERT EN BD ─────────────────────────────────────────────────────────────

/**
 * Hace upsert de los registros validados en la tabla `productos`.
 * Usa el índice único (empresa_id, agora_id) para evitar duplicados.
 */
async function upsertProductosAgora(
  validos: AgoraBatchResult["validos"],
  empresaId: string
): Promise<{ insertados: number; errorUpsert?: string }> {
  const { supabase } = await getLogisticaContext();

  const rows = validos.map((v) => ({
    empresa_id: empresaId,
    agora_id: v.agora_id,
    nombre: v.nombre,
    categoria: v.categoria,
    precio_venta: v.precio_venta,
    tipo: v.tipo,
    estado: v.estado,
    unidad: v.unidad,
  }));

  const { data, error } = await supabase
    .from("productos")
    .upsert(rows, { onConflict: "empresa_id,agora_id" })
    .select("id");

  if (error) {
    return { insertados: 0, errorUpsert: error.message };
  }

  return { insertados: data?.length ?? 0 };
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * Sincroniza ventas de Ágora POS hacia la tabla `productos`.
 *
 * POLÍTICA DE REINTENTOS (Fail-Safe):
 *   - Máx MAX_REINTENTOS intentos con backoff exponencial (1s → 2s → 4s)
 *   - Tras agotar reintentos: status="error", NO sigue solo
 *   - El caller debe mostrar el error exacto y pedir aprobación al usuario
 *
 * @param reintentoManual - Si true, es un reintento aprobado por el usuario
 * @param intentoActual  - Número de intento (interno, para backoff)
 */
export async function syncVentasAgora(
  reintentoManual = false,
  intentoActual = 0
): Promise<SyncResult> {
  const agoraUrl = process.env.AGORA_API_URL;

  if (!agoraUrl) {
    return {
      success: false,
      status: "error",
      totalRecords: 0,
      okRecords: 0,
      errorRecords: 0,
      retryCount: intentoActual,
      errorMessage:
        "AGORA_API_URL no está configurada. Añade la variable de entorno antes de sincronizar.",
    };
  }

  const { empresaId, userId } = await getLogisticaContext();

  if (!empresaId) {
    return {
      success: false,
      status: "error",
      totalRecords: 0,
      okRecords: 0,
      errorRecords: 0,
      retryCount: intentoActual,
      errorMessage: "No se pudo obtener el empresa_id del usuario autenticado.",
    };
  }

  // ─── Backoff exponencial entre reintentos ──────────────────
  if (intentoActual > 0) {
    const delayMs = Math.pow(2, intentoActual - 1) * 1000; // 1s, 2s, 4s
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // ─── Fetch datos de Ágora ──────────────────────────────────
  let registrosCrudos: unknown[];
  try {
    registrosCrudos = await fetchAgoraConTimeout(agoraUrl);
  } catch (err) {
    const esTimeout = err instanceof Error && err.name === "AbortError";
    const status: AgoraSyncStatus = esTimeout ? "timeout" : "error";
    const errorMessage = esTimeout
      ? `Ágora no respondió en ${AGORA_TIMEOUT_MS / 1000}s. Intento ${intentoActual + 1}/${MAX_REINTENTOS}.`
      : `Error de red al contactar Ágora: ${err instanceof Error ? err.message : String(err)}`;

    // Guardar intento fallido en log
    await guardarSyncLog({
      empresa_id: empresaId,
      status,
      total_records: 0,
      ok_records: 0,
      error_records: 0,
      retry_count: intentoActual,
      error_detail: null,
      created_by: userId,
    });

    // ¿Quedan reintentos automáticos? (solo si reintentoManual=false y no se agotaron)
    if (!reintentoManual && intentoActual < MAX_REINTENTOS - 1) {
      return syncVentasAgora(false, intentoActual + 1);
    }

    // Sin más reintentos automáticos — Regla Seguridad Ágora: devolver error exacto
    return {
      success: false,
      status,
      totalRecords: 0,
      okRecords: 0,
      errorRecords: 0,
      retryCount: intentoActual + 1,
      errorMessage,
    };
  }

  // ─── Validar registros con Zod ─────────────────────────────
  const { validos, errores } = validarLoteAgora(registrosCrudos);
  const totalRecords = registrosCrudos.length;

  // ─── Upsert en BD ──────────────────────────────────────────
  let okRecords = 0;
  if (validos.length > 0) {
    const { insertados, errorUpsert } = await upsertProductosAgora(validos, empresaId);

    if (errorUpsert) {
      const entry: AgoraSyncLogEntry = {
        empresa_id: empresaId,
        status: "error",
        total_records: totalRecords,
        ok_records: 0,
        error_records: totalRecords,
        retry_count: intentoActual,
        error_detail: [{ registro: null, motivo: errorUpsert, campo: "upsert" }],
        created_by: userId,
      };
      await guardarSyncLog(entry);

      return {
        success: false,
        status: "error",
        totalRecords,
        okRecords: 0,
        errorRecords: totalRecords,
        retryCount: intentoActual,
        errorMessage: `Error al guardar en BD: ${errorUpsert}`,
      };
    }

    okRecords = insertados;
  }

  // ─── Determinar status final ───────────────────────────────
  const finalStatus: AgoraSyncStatus =
    errores.length === 0
      ? "ok"
      : okRecords > 0
        ? "partial"
        : "error";

  await guardarSyncLog({
    empresa_id: empresaId,
    status: finalStatus,
    total_records: totalRecords,
    ok_records: okRecords,
    error_records: errores.length,
    retry_count: intentoActual,
    error_detail: errores.length > 0 ? errores : null,
    created_by: userId,
  });

  return {
    success: finalStatus === "ok" || finalStatus === "partial",
    status: finalStatus,
    totalRecords,
    okRecords,
    errorRecords: errores.length,
    retryCount: intentoActual,
    errorDetail: errores.length > 0 ? errores : undefined,
  };
}
