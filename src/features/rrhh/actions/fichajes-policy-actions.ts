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

/**
 * Cortesía (el margen que se redondea a la hora del turno): tope de 15 min.
 * El mínimo para poder cerrar un fichaje son 30, así que por encima de 15 las
 * dos ventanas se pisarían. El desplegable ya no ofrece más, pero quien manda
 * es el servidor: aquí se corta venga de donde venga.
 */
function clampCortesia(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(15, Math.max(0, Math.round(n)));
}

/**
 * Mínimo para poder cerrar un fichaje: nunca menos de 30 minutos. Es el pacto,
 * y lo que hace que jamás se pise con la cortesía (topada en 15).
 */
function clampMinCierre(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(240, Math.max(30, Math.round(n)));
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

    return {
      ok: true,
      data: {
        permitirAntes: !!data.permitir_antes,
        margenAntesMin: (data.margen_antes_min as number) ?? 15,
        permitirDespues: !!data.permitir_despues,
        margenDespuesMin: (data.margen_despues_min as number) ?? 15,
        redondearAntes: !!data.redondear_antes,
        redondearDespues: !!data.redondear_despues,
        popupMargenAntesMin: (data.popup_margen_antes_min as number) ?? 15,
        popupMargenDespuesMin: (data.popup_margen_despues_min as number) ?? 15,
        permitirFueraHorario: !!data.permitir_fuera_horario,
        reavisoActivo: !!data.reaviso_activo,
        reavisoIntervaloMin: (data.reaviso_intervalo_min as number) ?? 5,
        avisoSonido: !!data.aviso_sonido,
        avisoVibracion: !!data.aviso_vibracion,
        autoSalidaActiva: !!data.auto_salida_activa,
        autoSalidaMargenMin: (data.auto_salida_margen_min as number) ?? 15,
        minMinutosParaCerrar: clampMinCierre((data.min_minutos_para_cerrar as number) ?? 30),
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
        margen_antes_min: clampCortesia(input.margenAntesMin),
        permitir_despues: input.permitirDespues,
        margen_despues_min: clampCortesia(input.margenDespuesMin),
        redondear_antes: input.redondearAntes,
        redondear_despues: input.redondearDespues,
        popup_margen_antes_min: clampMargen(input.popupMargenAntesMin),
        popup_margen_despues_min: clampMargen(input.popupMargenDespuesMin),
        permitir_fuera_horario: input.permitirFueraHorario,
        reaviso_activo: input.reavisoActivo,
        reaviso_intervalo_min: clampIntervalo(input.reavisoIntervaloMin),
        aviso_sonido: input.avisoSonido,
        aviso_vibracion: input.avisoVibracion,
        auto_salida_activa: input.autoSalidaActiva,
        auto_salida_margen_min: clampMargen(input.autoSalidaMargenMin),
        min_minutos_para_cerrar: clampMinCierre(input.minMinutosParaCerrar),
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
