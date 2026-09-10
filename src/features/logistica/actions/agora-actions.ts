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
  /** Parte de la pasada: facturas, líneas, complementos y qué pasó con el stock. */
  sales_data: unknown;
}

// ─── EL ESPEJO DE STOCK YA NO EXISTE ─────────────────────────────────────────
//
// Aquí vivía `syncVentasAgoraAction`, que traía las existencias de Ágora y **pisaba
// `stock.cantidad_actual`** con ellas, sin dejar ni un apunte en el historial.
//
// Se retira en el PRP-080 Fase 2 por dos razones que se suman:
//   1. Iván decidió en julio que **Balles manda el stock**, no Ágora. El espejo era
//      un apaño de la transición.
//   2. Desde que el kardex se recalcula solo, el saldo sale del histórico. Un espejo
//      que escribe el saldo por su cuenta lo deja en un valor que el libro no explica,
//      hasta el siguiente movimiento — y con el almacén cerrado, ni eso.
//
// Lo que sí sigue: la ingesta de ventas (`agora-ventas-ingesta.ts`), que es el camino
// bueno, y su registro en `agora_sync_log`, que se sigue leyendo aquí abajo.

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
      .select("id, sync_at, status, total_records, ok_records, error_records, retry_count, error_detail, sales_data")
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
      .select("id, sync_at, status, total_records, ok_records, error_records, retry_count, error_detail, sales_data")
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
