"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppContext } from "@/lib/supabase/get-context";
import type { ModeloTipo } from "../types/modelos";

export interface ModelosConfig {
  /** null = todos los tipos activos. */
  tipos_activos: ModeloTipo[] | null;
  email_trim_activo: boolean;
  email_trim_dias_offset: number;
  email_anual_activo: boolean;
  email_anual_dias_offset: number;
}

export const MODELOS_CONFIG_DEFAULT: ModelosConfig = {
  tipos_activos: null,
  email_trim_activo: false,
  email_trim_dias_offset: 1,
  email_anual_activo: false,
  email_anual_dias_offset: 1,
};

const COLS =
  "tipos_activos, email_trim_activo, email_trim_dias_offset, email_anual_activo, email_anual_dias_offset";

type Row = {
  tipos_activos: string[] | null;
  email_trim_activo: boolean | null;
  email_trim_dias_offset: number | null;
  email_anual_activo: boolean | null;
  email_anual_dias_offset: number | null;
};

function normalizar(row: Row | null): ModelosConfig {
  return {
    tipos_activos: (row?.tipos_activos as ModeloTipo[] | null) ?? null,
    email_trim_activo: row?.email_trim_activo ?? false,
    email_trim_dias_offset: row?.email_trim_dias_offset ?? 1,
    email_anual_activo: row?.email_anual_activo ?? false,
    email_anual_dias_offset: row?.email_anual_dias_offset ?? 1,
  };
}

const clampOffset = (n: unknown) =>
  Math.max(-60, Math.min(60, Math.round(Number(n) || 1)));

export async function getModelosConfig(): Promise<{ ok: boolean; data: ModelosConfig }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: MODELOS_CONFIG_DEFAULT };
    const { data } = await supabase
      .from("modelos_config")
      .select(COLS)
      .eq("empresa_id", empresaId)
      .maybeSingle<Row>();
    return { ok: true, data: normalizar(data) };
  } catch (err) {
    console.error("[modelos] getModelosConfig:", err);
    return { ok: false, data: MODELOS_CONFIG_DEFAULT };
  }
}

/** Versión sin sesión, para crons: recibe cliente admin + empresaId ya resuelto. */
export async function getModelosConfigPorEmpresa(
  admin: SupabaseClient,
  empresaId: string,
): Promise<ModelosConfig> {
  const { data } = await admin
    .from("modelos_config")
    .select(COLS)
    .eq("empresa_id", empresaId)
    .maybeSingle<Row>();
  return normalizar(data);
}

export async function saveModelosConfig(
  input: ModelosConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase.from("modelos_config").upsert(
      {
        empresa_id: empresaId,
        tipos_activos: input.tipos_activos,
        email_trim_activo: input.email_trim_activo,
        email_trim_dias_offset: clampOffset(input.email_trim_dias_offset),
        email_anual_activo: input.email_anual_activo,
        email_anual_dias_offset: clampOffset(input.email_anual_dias_offset),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] saveModelosConfig:", msg);
    return { ok: false, error: msg };
  }
}
