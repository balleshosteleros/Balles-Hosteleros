"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  DIAS_VACACIONES_DEFECTO,
  CLAVE_DIAS_VACACIONES,
} from "@/features/rrhh/data/calendario-config";

/**
 * Configuración del submódulo Calendario.
 *
 * Los días de vacaciones al año son UN valor por empresa, no una propiedad de un
 * "calendario" como entidad: aquí hay un único calendario donde se registran las
 * ausencias y los festivos, así que los días viven en la configuración de la
 * empresa (`empresas.datos_generales.diasVacacionesAnio`) y no en una tabla de
 * calendarios.
 */

// El valor por defecto y la clave viven en `data/calendario-config`: este
// fichero es "use server" y solo puede exportar funciones asíncronas.
const CLAVE = CLAVE_DIAS_VACACIONES;

function leerDias(datosGenerales: unknown): number {
  const dg = (datosGenerales as Record<string, unknown> | null) ?? {};
  const bruto = dg[CLAVE];
  const n = typeof bruto === "number" ? bruto : Number(bruto);
  // Sin configurar (o valor corrupto) => el estándar del convenio.
  if (!Number.isFinite(n) || n <= 0) return DIAS_VACACIONES_DEFECTO;
  return Math.round(n);
}

/** Días de vacaciones al año de una empresa. */
export async function getDiasVacacionesAnio(
  empresaId: string,
): Promise<{ ok: boolean; dias: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("empresas")
      .select("datos_generales")
      .eq("id", empresaId)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, dias: leerDias(data?.datos_generales) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendario-config] getDias:", msg);
    // Nunca dejar el saldo a 0 por un fallo de lectura: sería un dato falso.
    return { ok: false, dias: DIAS_VACACIONES_DEFECTO, error: msg };
  }
}

/** Guarda los días de vacaciones al año de una empresa. */
export async function setDiasVacacionesAnio(
  empresaId: string,
  dias: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(dias) || dias < 1 || dias > 366) {
    return { ok: false, error: "Los días deben ser un número entre 1 y 366" };
  }
  try {
    const supabase = await createClient();
    // Se conserva el resto de `datos_generales`: es un JSON compartido por
    // varias configuraciones de la empresa (correos, gestoría…).
    const { data: actual, error: errLee } = await supabase
      .from("empresas")
      .select("datos_generales")
      .eq("id", empresaId)
      .maybeSingle();
    if (errLee) throw errLee;

    const dg = (actual?.datos_generales as Record<string, unknown> | null) ?? {};
    const { error } = await supabase
      .from("empresas")
      .update({ datos_generales: { ...dg, [CLAVE]: dias } })
      .eq("id", empresaId);
    if (error) throw error;

    revalidatePath("/rrhh/calendarios");
    revalidatePath("/mi-panel");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendario-config] setDias:", msg);
    return { ok: false, error: msg };
  }
}
