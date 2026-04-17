"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { UMBRALES_DEFAULT, type UmbralesAlarma } from "../types";

interface UmbralesRow {
  empresa_id: string;
  umbral_ambar_min: number;
  umbral_rojo_min: number;
  umbral_parpadeo_min: number;
  sonido_activo: boolean;
  updated_at: string;
}

function rowToUmbrales(r: UmbralesRow): UmbralesAlarma {
  return {
    empresaId: r.empresa_id,
    umbralAmbarMin: r.umbral_ambar_min,
    umbralRojoMin: r.umbral_rojo_min,
    umbralParpadeoMin: r.umbral_parpadeo_min,
    sonidoActivo: r.sonido_activo,
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
