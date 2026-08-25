/**
 * Reparto de los días de vacaciones de un empleado en un año.
 *
 * El cupo del calendario se gasta en tres momentos distintos, y mezclarlos
 * oculta justo lo que hay que decidir:
 *
 *   - DISFRUTADOS: ya se han cogido (aprobadas que terminaron antes de hoy).
 *   - APROBADOS pendientes de disfrutar: concedidos y en el futuro. Son
 *     compromiso firme de la empresa; el turno ya hay que cubrirlo.
 *   - PENDIENTES de aprobación: solicitados, sin respuesta todavía. Reservan
 *     cupo (para que no pueda pedir dos veces lo mismo) pero aún se pueden
 *     denegar.
 *
 * Una solicitud EN CURSO (empezó pero no ha terminado) cuenta como disfrutada:
 * desde el punto de vista del cupo ya está consumida.
 *
 * Vive en `rrhh/data` porque lo usan las dos partes: el empleado en Mi Panel y
 * RRHH en la ficha. Antes el cálculo estaba copiado en tres sitios y cualquier
 * cambio tenía que hacerse tres veces o divergían.
 *
 * Los días se cuentan NATURALES (lunes a domingo = 7), igual que el cupo.
 */

/** Estados que consumen cupo. El resto (rechazada, anulada) no cuenta. */
export const ESTADOS_QUE_GASTAN = ["pendiente", "aprobada"] as const;

/**
 * Momento de una ausencia respecto a hoy. En el calendario importa tanto como
 * el estado: una vacación aprobada de marzo y otra de diciembre son la misma
 * "aprobada", pero una ya se disfrutó y la otra hay que cubrirla.
 */
export type MomentoAusencia = "disfrutada" | "en_curso" | "futura";

/**
 * Sitúa un rango respecto al día de hoy. Las fechas son "YYYY-MM-DD", así que
 * comparar las cadenas ordena igual que las fechas.
 *
 * Sin `fin` (una baja médica sin alta prevista) el rango sigue abierto: si ya
 * empezó está en curso, nunca "disfrutada".
 */
export function momentoDeAusencia(
  inicio: string,
  fin: string | null | undefined,
  hoy: string,
): MomentoAusencia {
  if (inicio > hoy) return "futura";
  if (!fin) return "en_curso";
  return fin < hoy ? "disfrutada" : "en_curso";
}

/** Una solicitud, con lo mínimo para repartirla. */
export interface SolicitudParaSaldo {
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string;
}

export interface SaldoVacaciones {
  diasTotales: number;
  /** Ya cogidos: aprobadas terminadas, y las que están en curso ahora mismo. */
  diasDisfrutados: number;
  /** Aprobados pero aún por disfrutar: compromiso firme, turno a cubrir. */
  diasAprobadosPendientes: number;
  /** Solicitados sin respuesta. Reservan cupo, pero pueden denegarse. */
  diasPendientesAprobacion: number;
  /** Suma de los tres: todo lo que ya no está libre. */
  diasGastados: number;
  /** Lo que aún puede pedir. Nunca negativo. */
  diasRestantes: number;
}

/**
 * Días naturales de una solicitud que caen DENTRO del año indicado, ambos
 * extremos incluidos. Una solicitud a caballo entre dos años solo gasta del año
 * que se está mirando.
 */
export function diasEnAnio(inicio: string, fin: string | null, anio: number): number {
  const ini = new Date(inicio + "T00:00:00Z");
  const end = new Date((fin ?? inicio) + "T00:00:00Z");
  if (Number.isNaN(ini.getTime()) || Number.isNaN(end.getTime())) return 0;
  const yearStart = new Date(Date.UTC(anio, 0, 1));
  const yearEndExclusive = new Date(Date.UTC(anio + 1, 0, 1));
  const lo = ini.getTime() > yearStart.getTime() ? ini : yearStart;
  const hi =
    end.getTime() < yearEndExclusive.getTime()
      ? end
      : new Date(yearEndExclusive.getTime() - 86400000);
  if (hi.getTime() < lo.getTime()) return 0;
  return Math.floor((hi.getTime() - lo.getTime()) / 86400000) + 1;
}

/**
 * Reparte las solicitudes en los tres momentos y calcula el saldo.
 *
 * `hoy` se pasa como parámetro (formato "YYYY-MM-DD") en vez de leerlo aquí:
 * el día depende de la zona horaria de la empresa, que decide quien llama.
 */
export function calcularSaldoVacaciones(
  solicitudes: SolicitudParaSaldo[],
  diasTotales: number,
  anio: number,
  hoy: string,
): SaldoVacaciones {
  let diasDisfrutados = 0;
  let diasAprobadosPendientes = 0;
  let diasPendientesAprobacion = 0;

  for (const s of solicitudes) {
    const dias = diasEnAnio(s.fecha_inicio, s.fecha_fin, anio);
    if (dias === 0) continue;

    if (s.estado === "pendiente") {
      diasPendientesAprobacion += dias;
      continue;
    }
    if (s.estado !== "aprobada") continue;

    // Ya empezada (o terminada) = disfrutada. Comparar las cadenas ISO basta:
    // "2026-03-09" < "2026-03-10" ordena igual que las fechas.
    if (s.fecha_inicio <= hoy) {
      diasDisfrutados += dias;
    } else {
      diasAprobadosPendientes += dias;
    }
  }

  const diasGastados = diasDisfrutados + diasAprobadosPendientes + diasPendientesAprobacion;
  return {
    diasTotales,
    diasDisfrutados,
    diasAprobadosPendientes,
    diasPendientesAprobacion,
    diasGastados,
    diasRestantes: Math.max(0, diasTotales - diasGastados),
  };
}
