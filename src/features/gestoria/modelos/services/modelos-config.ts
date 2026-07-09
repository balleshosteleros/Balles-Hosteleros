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
  email_trim_activo: boolean;
  email_trim_dias_offset: number;
  email_anual_activo: boolean;
  email_anual_dias_offset: number;
}

export const MODELOS_CONFIG_DEFAULT: ModelosConfig = {
  tipos_activos: null,
  tipos_obligatorios: null,
  email_trim_activo: false,
  email_trim_dias_offset: 1,
  email_anual_activo: false,
  email_anual_dias_offset: 1,
};

export const MODELOS_CONFIG_COLS =
  "tipos_activos, tipos_obligatorios, email_trim_activo, email_trim_dias_offset, email_anual_activo, email_anual_dias_offset";

export type ModelosConfigRow = {
  tipos_activos: string[] | null;
  tipos_obligatorios: string[] | null;
  email_trim_activo: boolean | null;
  email_trim_dias_offset: number | null;
  email_anual_activo: boolean | null;
  email_anual_dias_offset: number | null;
};

export function normalizarModelosConfig(row: ModelosConfigRow | null): ModelosConfig {
  return {
    tipos_activos: (row?.tipos_activos as ModeloTipo[] | null) ?? null,
    tipos_obligatorios: (row?.tipos_obligatorios as ModeloTipo[] | null) ?? null,
    email_trim_activo: row?.email_trim_activo ?? false,
    email_trim_dias_offset: row?.email_trim_dias_offset ?? 1,
    email_anual_activo: row?.email_anual_activo ?? false,
    email_anual_dias_offset: row?.email_anual_dias_offset ?? 1,
  };
}

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
    (t) => !cfg.tipos_activos || cfg.tipos_activos.includes(t),
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
