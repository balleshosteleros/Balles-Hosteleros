"use server";

/**
 * Datos de contrato del empleado para «Mi Panel → Condiciones».
 *
 * Antes esta tarjeta pintaba valores inventados: la fecha de alta era el texto
 * fijo «Pendiente de configurar», el tipo de contrato siempre «Indefinido» y
 * los días restantes de vacaciones se calculaban como «total − 8». Ahora todo
 * sale de la FICHA del empleado y del saldo real de vacaciones, que es el mismo
 * número que ve RRHH.
 *
 * La fecha de baja solo existe cuando el empleado pasa a offboarding desde
 * Reclutamiento; mientras tanto se devuelve `null` y la vista pinta un guion.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { getDiasVacacionesAnio } from "@/features/rrhh/actions/calendario-config-actions";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  calcularSaldoVacaciones,
  ESTADOS_QUE_GASTAN,
  type SolicitudParaSaldo,
} from "@/features/rrhh/data/vacaciones-saldo";

export interface MisCondicionesContrato {
  /** Días de vacaciones al año de la empresa (Ajustes → Calendario). */
  vacacionesAno: number;
  /** Los que le quedan de verdad, descontando lo ya disfrutado y lo aprobado. */
  vacacionesRestantes: number;
  /** ISO (yyyy-mm-dd) o null si su ficha no la tiene todavía. */
  fechaAlta: string | null;
  /** ISO o null. Solo se rellena al pasar a offboarding. */
  fechaBaja: string | null;
  /** Tal cual figura en su ficha: "Completa", "Parcial"… null si no consta. */
  tipoJornada: string | null;
  /** Su puesto real (empleado_puestos), no el adivinado por el nombre. */
  puesto: string | null;
}

export async function getMisCondicionesContrato(): Promise<{
  ok: boolean;
  data: MisCondicionesContrato | null;
  error?: string;
}> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, data: null, error: "No autenticado" };

    // La ficha de ESTA empresa: un empleado puede tener ficha en las dos
    // sociedades con fechas de alta distintas (p. ej. quien se fue y volvió).
    const { data: emp } = await supabase
      .from("empleados")
      .select("id, fecha_alta, fecha_baja, tipo_jornada, puesto")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const { dias: diasTotales } = await getDiasVacacionesAnio(empresaId);

    // Saldo real: mismo cálculo que usa RRHH, para que ambos vean lo mismo.
    const anio = new Date().getUTCFullYear();
    const { data: solicitudes } = await supabase
      .from("solicitudes_personal")
      .select("fecha_inicio, fecha_fin, estado")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .eq("tipo", "ausencia")
      .eq("subtipo", "vacaciones")
      .in("estado", ESTADOS_QUE_GASTAN)
      .lt("fecha_inicio", `${anio + 1}-01-01`)
      .or(`fecha_fin.gte.${anio}-01-01,fecha_fin.is.null`);

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const saldo = calcularSaldoVacaciones(
      (solicitudes ?? []) as SolicitudParaSaldo[],
      diasTotales,
      anio,
      hoyEnZona(tz),
    );

    return {
      ok: true,
      data: {
        vacacionesAno: diasTotales,
        vacacionesRestantes: saldo.diasRestantes,
        fechaAlta: (emp?.fecha_alta as string | null) ?? null,
        fechaBaja: (emp?.fecha_baja as string | null) ?? null,
        tipoJornada: (emp?.tipo_jornada as string | null) ?? null,
        puesto: (emp?.puesto as string | null) ?? null,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mis-condiciones] getMisCondicionesContrato:", msg);
    return { ok: false, data: null, error: msg };
  }
}
