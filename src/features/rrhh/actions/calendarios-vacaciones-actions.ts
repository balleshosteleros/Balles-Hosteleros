"use server";

/**
 * Saldo de vacaciones de un empleado.
 *
 * Antes este fichero gestionaba "calendarios de vacaciones" como entidad (crear,
 * editar, borrar y asignar uno a cada empleado). Ese modelo se ha eliminado: en
 * el negocio hay UN solo calendario por empresa, y los días al año viven en la
 * configuración del submódulo Calendario. Aquí queda solo el cálculo del saldo.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { type SaldoVacaciones } from "@/features/rrhh/data/calendarios-vacaciones";
import {
  calcularSaldoVacaciones,
  ESTADOS_QUE_GASTAN,
  type SolicitudParaSaldo,
} from "@/features/rrhh/data/vacaciones-saldo";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { getDiasVacacionesAnio } from "@/features/rrhh/actions/calendario-config-actions";

type Sb = Awaited<ReturnType<typeof getAppContext>>["supabase"];

/**
 * Calcula el saldo de vacaciones de un empleado para un año. Cuenta como
 * gastados los días naturales de sus solicitudes de vacaciones pendientes o
 * aprobadas que caen en ese año.
 */
export async function getSaldoVacacionesEmpleado(
  empleadoId: string,
  anio?: number,
): Promise<{ ok: boolean; data: SaldoVacaciones | null; error?: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id, empresa_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (!emp) return { ok: false, data: null, error: "Empleado no encontrado" };

    // `calendarioId`/`calendarioNombre` se mantienen en la respuesta por
    // compatibilidad con quien la consume, pero ya no existen calendarios.
    const calendarioId: string | null = null;
    const calendarioNombre: string | null = null;
    const anioCalc = anio ?? new Date().getUTCFullYear();

    // Los días salen de la CONFIGURACIÓN de la empresa (Calendario → Días de
    // vacaciones), no de un "calendario" por empleado: aquí hay un único
    // calendario para todos, así que el saldo no depende de a cuál apunte.
    const { dias: diasTotales } = await getDiasVacacionesAnio(emp.empresa_id as string);

    const saldo = await calcularSaldoEmpleado(
      supabase,
      emp.empresa_id as string,
      emp.user_id as string,
      anioCalc,
      diasTotales,
    );

    return {
      ok: true,
      data: { calendarioId, calendarioNombre, anio: anioCalc, ...saldo },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] getSaldo:", msg);
    return { ok: false, data: null, error: msg };
  }
}

/**
 * Reparto de los días de vacaciones de un empleado en un año: disfrutados,
 * aprobados por disfrutar y pendientes de aprobación. Comparte el cálculo con
 * Mi Panel para que empleado y RRHH vean exactamente los mismos números.
 */
async function calcularSaldoEmpleado(
  supabase: Sb,
  empresaId: string,
  userId: string,
  anio: number,
  diasTotales: number,
) {
  const inicioAnio = `${anio}-01-01`;
  const inicioAnioSig = `${anio + 1}-01-01`;
  const { data } = await supabase
    .from("solicitudes_personal")
    .select("fecha_inicio, fecha_fin, estado")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .eq("tipo", "ausencia")
    .eq("subtipo", "vacaciones")
    .in("estado", ESTADOS_QUE_GASTAN)
    .lt("fecha_inicio", inicioAnioSig)
    .or(`fecha_fin.gte.${inicioAnio},fecha_fin.is.null`);

  // "Ya disfrutado" se decide contra el día de la empresa, no en UTC.
  const tz = await getZonaHorariaEmpresa(supabase, empresaId);
  return calcularSaldoVacaciones(
    (data ?? []) as SolicitudParaSaldo[],
    diasTotales,
    anio,
    hoyEnZona(tz),
  );
}
