"use server";

/**
 * Server Actions para la integración con Ágora POS.
 *
 * REGLA DE SEGURIDAD ÁGORA (obligatoria en todas las acciones):
 *   Ante cualquier error con Ágora o fallo de persistencia:
 *   1. Detener inmediatamente
 *   2. Devolver el error exacto (nunca swallow)
 *   3. El cliente mostrará: "Balles, el botón [X] ha fallado al comunicarse
 *      con Ágora. ¿Quieres que reintente la conexión, que ignore el error
 *      o que cree un registro de backup?"
 *   4. Solo actuar bajo aprobación explícita del usuario
 */

import { revalidatePath } from "next/cache";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { syncVentasAgora } from "@/features/logistica/services/agora-sync";
import type { AgoraSyncStatus } from "@/features/logistica/types/agora";

// ─── TIPOS DE RESPUESTA ───────────────────────────────────────────────────────

export interface AgoraSyncActionResult {
  ok: boolean;
  status: AgoraSyncStatus;
  mensaje: string;
  totalRecords: number;
  okRecords: number;
  errorRecords: number;
  retryCount: number;
  errorDetail?: unknown;
}

export interface AgoraSyncLog {
  id: string;
  sync_at: string;
  status: AgoraSyncStatus;
  total_records: number;
  ok_records: number;
  error_records: number;
  retry_count: number;
  error_detail: unknown;
}

// ─── INICIAR SINCRONIZACIÓN ───────────────────────────────────────────────────

/**
 * Dispara una sincronización de ventas con Ágora POS.
 *
 * Si falla, devuelve el error exacto sin intentar arreglarlo.
 * El componente AgoraSyncStatus mostrará el error al usuario y pedirá aprobación.
 *
 * @param esReintentoAprobado - true solo si el usuario aprobó explícitamente reintentar
 */
export async function syncVentasAgoraAction(
  esReintentoAprobado = false
): Promise<AgoraSyncActionResult> {
  try {
    const result = await syncVentasAgora(esReintentoAprobado);

    revalidatePath("/logistica");

    if (!result.success) {
      // Regla Seguridad Ágora: devolver error exacto sin modificarlo
      return {
        ok: false,
        status: result.status,
        mensaje: result.errorMessage ?? "Error desconocido en la sincronización con Ágora.",
        totalRecords: result.totalRecords,
        okRecords: result.okRecords,
        errorRecords: result.errorRecords,
        retryCount: result.retryCount,
        errorDetail: result.errorDetail,
      };
    }

    const mensajeExito =
      result.status === "ok"
        ? `Sincronización completada: ${result.okRecords} productos actualizados.`
        : `Sincronización parcial: ${result.okRecords} de ${result.totalRecords} registros procesados. ${result.errorRecords} con errores.`;

    return {
      ok: true,
      status: result.status,
      mensaje: mensajeExito,
      totalRecords: result.totalRecords,
      okRecords: result.okRecords,
      errorRecords: result.errorRecords,
      retryCount: result.retryCount,
      errorDetail: result.errorDetail,
    };
  } catch (err) {
    // Error inesperado — Regla Seguridad Ágora: mostrar error exacto
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: "error",
      mensaje: `Error inesperado al sincronizar con Ágora: ${errorMessage}`,
      totalRecords: 0,
      okRecords: 0,
      errorRecords: 0,
      retryCount: 0,
    };
  }
}

// ─── ÚLTIMO REGISTRO DE SYNC ──────────────────────────────────────────────────

/**
 * Devuelve el último registro de sincronización con Ágora para la empresa actual.
 * Usado por AgoraSyncStatus para mostrar el estado en la UI.
 */
export async function getLastSyncLog(): Promise<{
  data: AgoraSyncLog | null;
  error: string | null;
}> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();

    if (!empresaId) {
      return { data: null, error: "No se pudo obtener el empresa_id del usuario." };
    }

    const { data, error } = await supabase
      .from("agora_sync_log")
      .select("id, sync_at, status, total_records, ok_records, error_records, retry_count, error_detail")
      .eq("empresa_id", empresaId)
      .order("sync_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as AgoraSyncLog | null, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Error al consultar sync log: ${errorMessage}` };
  }
}

// ─── HISTORIAL DE SYNCS ───────────────────────────────────────────────────────

/**
 * Devuelve los últimos N registros de sincronización con Ágora.
 * @param limit - Número de registros a devolver (default 10)
 */
export async function getSyncLogHistory(limit = 10): Promise<{
  data: AgoraSyncLog[];
  error: string | null;
}> {
  try {
    const { supabase, empresaId } = await getLogisticaContext();

    if (!empresaId) {
      return { data: [], error: "No se pudo obtener el empresa_id del usuario." };
    }

    const { data, error } = await supabase
      .from("agora_sync_log")
      .select("id, sync_at, status, total_records, ok_records, error_records, retry_count, error_detail")
      .eq("empresa_id", empresaId)
      .order("sync_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as AgoraSyncLog[]) ?? [], error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { data: [], error: `Error al consultar historial de sync: ${errorMessage}` };
  }
}
