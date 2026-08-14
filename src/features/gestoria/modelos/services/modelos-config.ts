/**
 * Tipos + defaults + lectura sin-sesión de la config del submódulo Modelos.
 * NO es un fichero de server actions (por eso puede exportar constantes y
 * recibir un SupabaseClient). Las server actions viven en
 * ../actions/modelos-config-actions.ts.
 *
 * Nota: sin `server-only` a propósito — el tipo `ModelosConfig` y
 * `MODELOS_CONFIG_DEFAULT` los consume también el dialog cliente. La función
 * `getModelosConfigPorEmpresa` recibe el cliente admin ya creado por el cron.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeloTipo } from "../types/modelos";

export interface ModelosConfig {
  /** null = todos los tipos activos. */
  tipos_activos: ModeloTipo[] | null;
  /** Obligatorios en el enlace de la gestoría. null = todos los visibles. */
  tipos_obligatorios: ModeloTipo[] | null;
  /**
   * Tipos que NO aplican a esta empresa: se ocultan incluso en Ajustes (p. ej.
   * el 130 en sociedades). Distinto de "inactivo", que sí se sigue viendo para
   * poder reactivarlo. Es por empresa: otras lo conservan.
   */
  tipos_ocultos: ModeloTipo[];
  email_trim_activo: boolean;
  email_trim_dias_offset: number;
  email_anual_activo: boolean;
  email_anual_dias_offset: number;
  /**
   * Recordatorio INFORMATIVO N días ANTES de vencer el plazo ("en 5 días vence
   * el 2T"). No pide nada a la gestoría ni genera enlace de subida: eso es el
   * aviso posterior al vencimiento (email_trim/anual_activo).
   */
  recordatorio_previo_activo: boolean;
  recordatorio_previo_dias: number;
}

/**
 * Aviso a la gestoría ACTIVO por defecto: toda empresa nueva nace pidiendo sus
 * modelos sola, sin que nadie tenga que acordarse de encender el interruptor.
 * Con el aviso apagado no sale ningún correo y los modelos se quedan en
 * borrador aunque la gestoría los haya presentado (caso real 2T 2026).
 */
export const MODELOS_CONFIG_DEFAULT: ModelosConfig = {
  tipos_activos: null,
  tipos_obligatorios: null,
  tipos_ocultos: [],
  email_trim_activo: true,
  email_trim_dias_offset: 1,
  email_anual_activo: true,
  email_anual_dias_offset: 1,
  recordatorio_previo_activo: true,
  recordatorio_previo_dias: 5,
};

export const MODELOS_CONFIG_COLS =
  "tipos_activos, tipos_obligatorios, tipos_ocultos, email_trim_activo, email_trim_dias_offset, email_anual_activo, email_anual_dias_offset, recordatorio_previo_activo, recordatorio_previo_dias";

export type ModelosConfigRow = {
  tipos_activos: string[] | null;
  tipos_obligatorios: string[] | null;
  tipos_ocultos: string[] | null;
  email_trim_activo: boolean | null;
  email_trim_dias_offset: number | null;
  email_anual_activo: boolean | null;
  email_anual_dias_offset: number | null;
  recordatorio_previo_activo: boolean | null;
  recordatorio_previo_dias: number | null;
};

export function normalizarModelosConfig(row: ModelosConfigRow | null): ModelosConfig {
  return {
    tipos_activos: (row?.tipos_activos as ModeloTipo[] | null) ?? null,
    tipos_obligatorios: (row?.tipos_obligatorios as ModeloTipo[] | null) ?? null,
    tipos_ocultos: (row?.tipos_ocultos as ModeloTipo[] | null) ?? [],
    // Sin fila de config (empresa nueva) ⇒ avisos ACTIVOS, igual que el default.
    email_trim_activo: row?.email_trim_activo ?? MODELOS_CONFIG_DEFAULT.email_trim_activo,
    email_trim_dias_offset: row?.email_trim_dias_offset ?? MODELOS_CONFIG_DEFAULT.email_trim_dias_offset,
    email_anual_activo: row?.email_anual_activo ?? MODELOS_CONFIG_DEFAULT.email_anual_activo,
    email_anual_dias_offset: row?.email_anual_dias_offset ?? MODELOS_CONFIG_DEFAULT.email_anual_dias_offset,
    recordatorio_previo_activo:
      row?.recordatorio_previo_activo ?? MODELOS_CONFIG_DEFAULT.recordatorio_previo_activo,
    recordatorio_previo_dias:
      row?.recordatorio_previo_dias ?? MODELOS_CONFIG_DEFAULT.recordatorio_previo_dias,
  };
}

/** Antelación del recordatorio previo, acotada a la ventana válida (1-30 días). */
export const clampDiasPrevio = (n: unknown) =>
  Math.max(1, Math.min(30, Math.round(Number(n) || MODELOS_CONFIG_DEFAULT.recordatorio_previo_dias)));

/**
 * Tipos obligatorios EFECTIVOS para un grupo: los marcados obligatorios que
 * además estén visibles. null en tipos_obligatorios ⇒ todos los visibles del
 * grupo son obligatorios.
 */
export function tiposObligatoriosEfectivos(
  cfg: ModelosConfig,
  tiposDelGrupo: ModeloTipo[],
): ModeloTipo[] {
  const visibles = tiposDelGrupo.filter(
    (t) =>
      !cfg.tipos_ocultos.includes(t) &&
      (!cfg.tipos_activos || cfg.tipos_activos.includes(t)),
  );
  if (!cfg.tipos_obligatorios) return visibles;
  return visibles.filter((t) => cfg.tipos_obligatorios!.includes(t));
}

export const clampOffset = (n: unknown) =>
  Math.max(-60, Math.min(60, Math.round(Number(n) || 1)));

/** Lectura sin sesión (crons): recibe cliente admin + empresaId ya resuelto. */
export async function getModelosConfigPorEmpresa(
  admin: SupabaseClient,
  empresaId: string,
): Promise<ModelosConfig> {
  const { data } = await admin
    .from("modelos_config")
    .select(MODELOS_CONFIG_COLS)
    .eq("empresa_id", empresaId)
    .maybeSingle<ModelosConfigRow>();
  return normalizarModelosConfig(data);
}
