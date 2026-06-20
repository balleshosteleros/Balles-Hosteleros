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

function clampIntervalo(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.min(60, Math.max(1, Math.round(n)));
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

    const popupModo = data.popup_modo === "siempre" ? "siempre" : "ventana";
    return {
      ok: true,
      data: {
        permitirAntes: !!data.permitir_antes,
        margenAntesMin: (data.margen_antes_min as number) ?? 15,
        permitirDespues: !!data.permitir_despues,
        margenDespuesMin: (data.margen_despues_min as number) ?? 15,
        redondearAntes: !!data.redondear_antes,
        redondearDespues: !!data.redondear_despues,
        popupModo,
        popupMargenAntesMin: (data.popup_margen_antes_min as number) ?? 15,
        popupMargenDespuesMin: (data.popup_margen_despues_min as number) ?? 15,
        popupSinHorario: !!data.popup_sin_horario,
        permitirFueraHorario: !!data.permitir_fuera_horario,
        reavisoActivo: !!data.reaviso_activo,
        reavisoIntervaloMin: (data.reaviso_intervalo_min as number) ?? 5,
        avisoSonido: !!data.aviso_sonido,
        avisoVibracion: !!data.aviso_vibracion,
        autoSalidaActiva: !!data.auto_salida_activa,
        autoSalidaMargenMin: (data.auto_salida_margen_min as number) ?? 15,
        avisoCambioEmpresa: !!data.aviso_cambio_empresa,
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
        popup_modo: input.popupModo === "siempre" ? "siempre" : "ventana",
        popup_margen_antes_min: clampMargen(input.popupMargenAntesMin),
        popup_margen_despues_min: clampMargen(input.popupMargenDespuesMin),
        popup_sin_horario: input.popupSinHorario,
        permitir_fuera_horario: input.permitirFueraHorario,
        reaviso_activo: input.reavisoActivo,
        reaviso_intervalo_min: clampIntervalo(input.reavisoIntervaloMin),
        aviso_sonido: input.avisoSonido,
        aviso_vibracion: input.avisoVibracion,
        auto_salida_activa: input.autoSalidaActiva,
        auto_salida_margen_min: clampMargen(input.autoSalidaMargenMin),
        aviso_cambio_empresa: input.avisoCambioEmpresa,
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
