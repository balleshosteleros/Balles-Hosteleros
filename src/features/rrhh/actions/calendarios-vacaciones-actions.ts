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
  diasEnAnio,
  diasVacacionesDevengados,
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
  /**
   * Hasta qué día se cuenta. Sin indicar, hasta fin de año: es lo que se le
   * enseña mientras trabaja aquí, para que pueda planificar el verano en enero.
   * Con fecha (su último día de contrato), el saldo pasa a ser lo que hay que
   * liquidarle: devengado hasta ese día menos lo que ya disfrutó.
   */
  hastaIso?: string | null,
): Promise<{ ok: boolean; data: SaldoVacaciones | null; error?: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id, empresa_id, fecha_alta")
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
    // Si su baja YA está comunicada a la gestoría, el cupo se cuenta hasta su
    // último día aunque ese día todavía no haya llegado: desde que se tramita,
    // los días que le quedan son los que se van a liquidar, no los del año
    // entero. Si no, la pantalla enseñaría 17 días mientras a la gestoría se le
    // han mandado 9.
    let corte = hastaIso ?? null;
    if (!corte) {
      const { data: bajaRow } = await supabase
        .from("gestoria_bajas")
        .select("ultimo_dia")
        .eq("empresa_id", emp.empresa_id as string)
        .eq("empleado_id", empleadoId)
        .order("ultimo_dia", { ascending: false })
        .limit(1)
        .maybeSingle();
      corte = (bajaRow?.ultimo_dia as string | null) ?? null;
    }

    const { dias: diasAnio } = await getDiasVacacionesAnio(emp.empresa_id as string);

    // Los días SIEMPRE se cuentan desde su primer día de contrato: quien entra en
    // junio no tiene los mismos que quien lleva todo el año.
    const diasTotales = diasVacacionesDevengados(
      diasAnio,
      anioCalc,
      (emp.fecha_alta as string | null) ?? null,
      corte,
    );

    const saldo = await calcularSaldoEmpleado(
      supabase,
      emp.empresa_id as string,
      emp.user_id as string,
      anioCalc,
      diasTotales,
      corte,
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
  hastaIso: string | null = null,
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

  // "Ya disfrutado" se decide contra el día de la empresa, no en UTC. Con fecha
  // de corte (una baja), ese día es su último día de contrato: las vacaciones
  // que tuviera aprobadas para después no las va a disfrutar, así que no restan.
  const tz = await getZonaHorariaEmpresa(supabase, empresaId);
  const filas = ((data ?? []) as SolicitudParaSaldo[]).filter(
    (s) => !hastaIso || s.fecha_inicio <= hastaIso,
  );
  return calcularSaldoVacaciones(filas, diasTotales, anio, hastaIso ?? hoyEnZona(tz));
}

// ─── Histórico de movimientos ────────────────────────────────────────────────

export interface MovimientoVacaciones {
  /** Día al que se imputa el movimiento (ISO). */
  fecha: string;
  tipo: "disfrutadas" | "liquidadas" | "caducadas";
  /** Días que resta (siempre positivo). */
  dias: number;
  /** Texto para la línea del histórico. */
  detalle: string;
}

/**
 * Todo lo que le ha restado días de vacaciones en un año, en orden.
 *
 * Tres formas de perder días y las tres tienen que verse en el mismo sitio:
 *   · DISFRUTADAS — se las cogió.
 *   · LIQUIDADAS — se las pagaron en el finiquito al irse. Ese día lleva un
 *     billete verde en el calendario: no las disfrutó, las cobró.
 *   · CADUCADAS — las que le sobraron al acabar el año. No se acumulan.
 *
 * Se compone de lo que ya hay guardado (sus solicitudes y su baja): no hay un
 * registro aparte que pueda quedarse desfasado.
 */
export async function getMovimientosVacaciones(
  empleadoId: string,
  anio?: number,
): Promise<{ ok: boolean; movimientos: MovimientoVacaciones[] }> {
  try {
    const { supabase } = await getAppContext();
    const anioCalc = anio ?? new Date().getUTCFullYear();

    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id, empresa_id, fecha_alta")
      .eq("id", empleadoId)
      .maybeSingle();
    if (!emp?.empresa_id) return { ok: false, movimientos: [] };

    const movimientos: MovimientoVacaciones[] = [];

    // 1) Vacaciones disfrutadas: una línea por solicitud aprobada.
    const { data: sols } = await supabase
      .from("solicitudes_personal")
      .select("fecha_inicio, fecha_fin, estado")
      .eq("empresa_id", emp.empresa_id as string)
      .eq("user_id", emp.user_id as string)
      .eq("tipo", "ausencia")
      .eq("subtipo", "vacaciones")
      .eq("estado", "aprobada")
      .lt("fecha_inicio", `${anioCalc + 1}-01-01`)
      .or(`fecha_fin.gte.${anioCalc}-01-01,fecha_fin.is.null`);

    for (const s of (sols ?? []) as SolicitudParaSaldo[]) {
      const dias = diasEnAnio(s.fecha_inicio, s.fecha_fin, anioCalc);
      if (dias === 0) continue;
      const hasta = s.fecha_fin && s.fecha_fin !== s.fecha_inicio ? s.fecha_fin : null;
      movimientos.push({
        fecha: s.fecha_inicio,
        tipo: "disfrutadas",
        dias,
        detalle: hasta ? `Vacaciones del ${fmtEs(s.fecha_inicio)} al ${fmtEs(hasta)}` : `Vacaciones el ${fmtEs(s.fecha_inicio)}`,
      });
    }

    // 2) Liquidadas al causar baja: el número que se comunicó a la gestoría.
    const { data: baja } = await supabase
      .from("gestoria_bajas")
      .select("ultimo_dia, vacaciones_liquidadas")
      .eq("empresa_id", emp.empresa_id as string)
      .eq("empleado_id", empleadoId)
      .not("vacaciones_liquidadas", "is", null)
      .order("ultimo_dia", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ultimoDia = (baja?.ultimo_dia as string | null) ?? null;
    const liquidadas = (baja?.vacaciones_liquidadas as number | null) ?? null;
    if (ultimoDia && liquidadas != null && liquidadas > 0 && ultimoDia.startsWith(String(anioCalc))) {
      movimientos.push({
        fecha: ultimoDia,
        tipo: "liquidadas",
        dias: liquidadas,
        detalle: "Liquidadas en la nómina de fin de contrato",
      });
    }

    // 3) Caducadas: lo que sobró al acabar el año. Solo en años ya cerrados y si
    //    no se fue antes (quien causa baja no «pierde» días: se los pagan).
    const anioActual = new Date().getUTCFullYear();
    if (anioCalc < anioActual && !ultimoDia) {
      const saldo = await getSaldoVacacionesEmpleado(empleadoId, anioCalc);
      const sobrantes = saldo.data?.diasRestantes ?? 0;
      if (sobrantes > 0) {
        movimientos.push({
          fecha: `${anioCalc}-12-31`,
          tipo: "caducadas",
          dias: sobrantes,
          detalle: "No disfrutadas al acabar el año (no se acumulan)",
        });
      }
    }

    movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { ok: true, movimientos };
  } catch (err) {
    console.error("[calendarios-vacaciones] getMovimientosVacaciones:", err);
    return { ok: false, movimientos: [] };
  }
}

/** dd/mm/aaaa a partir de un ISO. */
function fmtEs(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
