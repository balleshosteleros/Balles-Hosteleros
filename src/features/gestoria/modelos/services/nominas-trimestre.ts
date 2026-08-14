import "server-only";

/**
 * Retenciones de RENDIMIENTOS DEL TRABAJO para el Modelo 111.
 *
 * El 111 declara lo retenido a EMPLEADOS (nóminas) y a PROFESIONALES (facturas
 * con retención). La parte de profesionales llega por `asignaciones_modelo`,
 * pero las nóminas NO son facturas: viven en `rrhh_pagos`, con el bruto en
 * `nomina` y la retención practicada en `irpf` (extraída del PDF real de la
 * gestoría). Sin esta lectura el 111 salía SIEMPRE a cero.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeloPeriodo } from "../types/modelos";

/** Meses "YYYY-MM" que cubre un trimestre (formato de `rrhh_pagos.periodo`). */
export function mesesDelPeriodo(periodo: ModeloPeriodo, ejercicio: number): string[] {
  const rangos: Record<ModeloPeriodo, [number, number]> = {
    T1: [1, 3],
    T2: [4, 6],
    T3: [7, 9],
    T4: [10, 12],
    ANUAL: [1, 12],
  };
  const [desde, hasta] = rangos[periodo];
  const meses: string[] = [];
  for (let m = desde; m <= hasta; m++) {
    meses.push(`${ejercicio}-${m.toString().padStart(2, "0")}`);
  }
  return meses;
}

export interface RetencionesTrabajo {
  /** Suma de los brutos de nómina del trimestre (casilla 01). */
  basePercepciones: number;
  /** Suma del IRPF retenido en esas nóminas (casilla 03). */
  retenciones: number;
  /** Nº de perceptores distintos con nómina en el trimestre (casilla 02). */
  numPerceptores: number;
}

/**
 * Agrega las nóminas del trimestre de una empresa. Cuenta perceptores ÚNICOS
 * (un empleado con tres nóminas en el trimestre es UN perceptor).
 */
export async function retencionesTrabajoDelTrimestre(
  supabase: SupabaseClient,
  empresaId: string,
  ejercicio: number,
  periodo: ModeloPeriodo,
): Promise<RetencionesTrabajo> {
  const meses = mesesDelPeriodo(periodo, ejercicio);

  const { data, error } = await supabase
    .from("rrhh_pagos")
    .select("empleado_id, nomina, irpf")
    .eq("empresa_id", empresaId)
    .in("periodo", meses);

  if (error) {
    console.error("[modelos] retencionesTrabajoDelTrimestre:", error.message);
    return { basePercepciones: 0, retenciones: 0, numPerceptores: 0 };
  }

  const filas = (data ?? []) as Array<{
    empleado_id: string | null;
    nomina: number | string | null;
    irpf: number | string | null;
  }>;

  const perceptores = new Set<string>();
  let basePercepciones = 0;
  let retenciones = 0;

  for (const f of filas) {
    basePercepciones += Number(f.nomina ?? 0);
    retenciones += Number(f.irpf ?? 0);
    if (f.empleado_id) perceptores.add(f.empleado_id);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    basePercepciones: round2(basePercepciones),
    retenciones: round2(retenciones),
    numPerceptores: perceptores.size,
  };
}
