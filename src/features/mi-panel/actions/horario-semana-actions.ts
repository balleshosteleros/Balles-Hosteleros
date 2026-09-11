"use server";

/**
 * La semana de horario, pedida desde el navegador.
 *
 * El móvil la pinta en el servidor al abrir la página; el panel de ordenador y
 * la ficha del empleado la piden aquí para poder pasar de una semana a otra sin
 * recargar. La lectura es la misma en los tres sitios.
 */

import {
  getMobileHorarioSemana,
  getHorarioSemanaDeEmpleado,
  type HorarioSemana,
} from "@/features/mi-panel/mobile/lib/mobile-horario-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/supabase/get-context";

/** Mi propia semana (la del trabajador que está mirando su panel). */
export async function getMiSemanaHorario(offsetSemanas = 0): Promise<HorarioSemana> {
  return getMobileHorarioSemana(offsetSemanas);
}

/**
 * La semana de UN empleado, para su ficha. Solo si es de la empresa activa:
 * la ficha es siempre de una empresa concreta.
 */
export async function getSemanaHorarioEmpleado(
  empleadoId: string,
  offsetSemanas = 0,
): Promise<HorarioSemana> {
  const { empresaId } = await getAppContext();
  const vacia = await getHorarioSemanaDeEmpleado("", "", offsetSemanas);
  if (!empresaId || !empleadoId) return vacia;

  const admin = createAdminClient();
  const { data } = await admin
    .from("empleados")
    .select("id")
    .eq("id", empleadoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data?.id) return vacia;

  return getHorarioSemanaDeEmpleado(data.id as string, empresaId, offsetSemanas);
}
