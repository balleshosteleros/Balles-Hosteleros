"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import {
  MODELOS_CONFIG_COLS,
  MODELOS_CONFIG_DEFAULT,
  clampOffset,
  normalizarModelosConfig,
  type ModelosConfig,
  type ModelosConfigRow,
} from "../services/modelos-config";

export async function getModelosConfig(): Promise<{ ok: boolean; data: ModelosConfig }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: MODELOS_CONFIG_DEFAULT };
    const { data } = await supabase
      .from("modelos_config")
      .select(MODELOS_CONFIG_COLS)
      .eq("empresa_id", empresaId)
      .maybeSingle<ModelosConfigRow>();
    return { ok: true, data: normalizarModelosConfig(data) };
  } catch (err) {
    console.error("[modelos] getModelosConfig:", err);
    return { ok: false, data: MODELOS_CONFIG_DEFAULT };
  }
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
