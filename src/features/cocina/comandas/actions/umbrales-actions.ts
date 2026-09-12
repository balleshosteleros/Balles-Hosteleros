"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { UMBRALES_DEFAULT, type UmbralesAlarma } from "../types";
import { horasApagadoSeguras } from "@/features/cocina/apagados/lib/caducidad";

interface UmbralesRow {
  empresa_id: string;
  umbral_ambar_min: number;
  umbral_rojo_min: number;
  umbral_parpadeo_min: number;
  sonido_activo: boolean;
  horas_apagado_producto: number | null;
  updated_at: string;
}

function rowToUmbrales(r: UmbralesRow): UmbralesAlarma {
  return {
    empresaId: r.empresa_id,
    umbralAmbarMin: r.umbral_ambar_min,
    umbralRojoMin: r.umbral_rojo_min,
    umbralParpadeoMin: r.umbral_parpadeo_min,
    sonidoActivo: r.sonido_activo,
    horasApagadoProducto: horasApagadoSeguras(r.horas_apagado_producto),
    updatedAt: r.updated_at,
  };
}

export async function getUmbralesAlarma(): Promise<
  { ok: true; data: UmbralesAlarma } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("cocina_alarmas_config")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        ok: true,
        data: {
          empresaId,
          ...UMBRALES_DEFAULT,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    return { ok: true, data: rowToUmbrales(data as UmbralesRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cocina][comandas] getUmbralesAlarma:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Cuánto dura el apagado de un producto agotado, en horas.
 *
 * Va aparte de los umbrales de alarma a propósito: es el único ajuste de
 * Comandas que hoy tiene pantalla, y obligar a mandar los tres umbrales para
 * cambiar las horas sería pedirle al que guarda datos que no ha tocado.
 */
export async function saveHorasApagadoProducto(
  horas: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const seguras = horasApagadoSeguras(horas);
    if (seguras !== Math.trunc(Number(horas))) {
      return { ok: false, error: "Pon un número de horas entre 1 y 72." };
    }

    // Si ya hay configuración, se toca SOLO esta columna. Un upsert con los
    // umbrales por defecto le habría devuelto sus alarmas al valor de fábrica
    // a quien las tuviera ajustadas, sin haberlas tocado.
    const { data: existente } = await supabase
      .from("cocina_alarmas_config")
      .select("empresa_id")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const { error } = existente
      ? await supabase
          .from("cocina_alarmas_config")
          .update({ horas_apagado_producto: seguras, updated_at: new Date().toISOString() })
          .eq("empresa_id", empresaId)
      : await supabase.from("cocina_alarmas_config").insert({
          empresa_id: empresaId,
          // Primera configuración de la empresa: los umbrales son obligatorios
          // en la tabla, así que estrenan su valor de fábrica.
          umbral_ambar_min: UMBRALES_DEFAULT.umbralAmbarMin,
          umbral_rojo_min: UMBRALES_DEFAULT.umbralRojoMin,
          umbral_parpadeo_min: UMBRALES_DEFAULT.umbralParpadeoMin,
          sonido_activo: UMBRALES_DEFAULT.sonidoActivo,
          horas_apagado_producto: seguras,
          updated_at: new Date().toISOString(),
        });

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cocina][comandas] saveHorasApagadoProducto:", msg);
    return { ok: false, error: msg };
  }
}

export async function saveUmbralesAlarma(input: {
  umbralAmbarMin: number;
  umbralRojoMin: number;
  umbralParpadeoMin: number;
  sonidoActivo: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Validación mínima: orden ascendente
    if (
      input.umbralAmbarMin <= 0 ||
      input.umbralRojoMin <= input.umbralAmbarMin ||
      input.umbralParpadeoMin <= input.umbralRojoMin
    ) {
      return {
        ok: false,
        error: "Los umbrales deben cumplir: 0 < ámbar < rojo < parpadeo.",
      };
    }

    const { error } = await supabase
      .from("cocina_alarmas_config")
      .upsert(
        {
          empresa_id: empresaId,
          umbral_ambar_min: input.umbralAmbarMin,
          umbral_rojo_min: input.umbralRojoMin,
          umbral_parpadeo_min: input.umbralParpadeoMin,
          sonido_activo: input.sonidoActivo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "empresa_id" },
      );

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cocina][comandas] saveUmbralesAlarma:", msg);
    return { ok: false, error: msg };
  }
}
