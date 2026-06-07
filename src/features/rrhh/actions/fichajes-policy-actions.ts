"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import {
  FICHAJE_POLICY_DEFAULT,
  type FichajePolicy,
} from "@/features/rrhh/data/fichaje-policy";

function clampMargen(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(120, Math.max(0, Math.round(n)));
}

export async function getFichajePolicy(): Promise<{
  ok: boolean;
  data: FichajePolicy;
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: { ...FICHAJE_POLICY_DEFAULT }, error: "No autenticado" };

    const { data, error } = await supabase
      .from("empresa_fichajes_config")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: { ...FICHAJE_POLICY_DEFAULT } };

    return {
      ok: true,
      data: {
        permitirAntes: !!data.permitir_antes,
        margenAntesMin: (data.margen_antes_min as number) ?? 15,
        permitirDespues: !!data.permitir_despues,
        margenDespuesMin: (data.margen_despues_min as number) ?? 15,
        redondearAntes: !!data.redondear_antes,
        redondearDespues: !!data.redondear_despues,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes-policy] getFichajePolicy:", msg);
    return { ok: false, data: { ...FICHAJE_POLICY_DEFAULT }, error: msg };
  }
}

export async function saveFichajePolicy(input: FichajePolicy) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { error } = await supabase.from("empresa_fichajes_config").upsert(
      {
        empresa_id: empresaId,
        permitir_antes: input.permitirAntes,
        margen_antes_min: clampMargen(input.margenAntesMin),
        permitir_despues: input.permitirDespues,
        margen_despues_min: clampMargen(input.margenDespuesMin),
        redondear_antes: input.redondearAntes,
        redondear_despues: input.redondearDespues,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id" },
    );
    if (error) throw error;
    revalidatePath("/rrhh/fichajes");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[fichajes-policy] saveFichajePolicy:", msg);
    return { ok: false, error: msg };
  }
}
