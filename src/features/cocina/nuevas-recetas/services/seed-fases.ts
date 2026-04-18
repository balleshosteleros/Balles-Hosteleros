"use server";

import { getAppContext } from "@/lib/supabase/get-context";

/**
 * Asegura que la empresa actual tiene las 5 fases seed.
 * Idempotente — si ya existen, no hace nada.
 */
export async function ensureFasesDefault(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa en contexto" };

    const { error } = await supabase.rpc("ensure_nueva_receta_seed", {
      p_empresa_id: empresaId,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[nuevas-recetas][seed]", msg);
    return { ok: false, error: msg };
  }
}
