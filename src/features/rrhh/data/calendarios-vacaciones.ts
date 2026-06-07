// Calendario de vacaciones (RRHH): un total de días de vacaciones para un año +
// una lista de periodos BLOQUEADOS en los que no se pueden pedir vacaciones.
// Cada empleado tiene un calendario asociado (empleados.calendario_vacaciones_id);
// al solicitar vacaciones se valida contra él (fechas y días disponibles).

export interface BloqueoVacaciones {
  id: string;
  /** Primer día bloqueado (ISO yyyy-mm-dd). */
  fechaInicio: string;
  /** Último día bloqueado, inclusive (ISO yyyy-mm-dd). */
  fechaFin: string;
  motivo: string | null;
}

export interface CalendarioVacaciones {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** null = predeterminado: aplica todos los años como referencia. */
  anio: number | null;
  diasTotales: number;
  activo: boolean;
  bloqueos: BloqueoVacaciones[];
  /** Empleados con este calendario asignado. */
  empleadosCount: number;
}

/** Saldo de vacaciones de un empleado para un año concreto. */
export interface SaldoVacaciones {
  /** null cuando el empleado no tiene calendario asignado. */
  calendarioId: string | null;
  calendarioNombre: string | null;
  anio: number;
  diasTotales: number;
  /** Días ya consumidos (solicitudes aprobadas o pendientes). */
  diasGastados: number;
  /** diasTotales - diasGastados (nunca negativo). */
  diasRestantes: number;
}

/**
 * Cuenta los días naturales (inclusive) de un rango [inicio, fin] que caen
 * dentro del año indicado. Usado tanto en cliente como en servidor para que el
 * recuento de días gastados/restantes sea idéntico en ambos lados.
 */
export function diasEnAnio(
  inicio: string,
  fin: string | null,
  anio: number,
): number {
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

/** ¿Se solapan los rangos [aIni,aFin] y [bIni,bFin]? (fechas ISO inclusive). */
export function rangosSeSolapan(
  aIni: string,
  aFin: string,
  bIni: string,
  bFin: string,
): boolean {
  return aIni <= bFin && bIni <= aFin;
}

/**
 * ¿El rango solicitado [reqInicio, reqFin] cae dentro de un periodo bloqueado?
 *
 * En un calendario PREDETERMINADO (esPredeterminado=true) el bloqueo se repite
 * cada año: solo cuentan el día y el mes. Se prueban las ocurrencias del bloqueo
 * en los años que toca la petición (incluido el cruce de fin de año, p. ej. un
 * bloqueo del 24/dic al 06/ene). En un calendario de un año concreto, se compara
 * el rango tal cual.
 */
export function bloqueoSolapaRango(
  bloqueo: { fechaInicio: string; fechaFin: string },
  reqInicio: string,
  reqFin: string,
  esPredeterminado: boolean,
): boolean {
  if (!esPredeterminado) {
    return reqInicio <= bloqueo.fechaFin && bloqueo.fechaInicio <= reqFin;
  }
  const mdIni = bloqueo.fechaInicio.slice(5); // "MM-DD"
  const mdFin = bloqueo.fechaFin.slice(5);
  const yIni = Number(reqInicio.slice(0, 4));
  const yFin = Number(reqFin.slice(0, 4));
  const years = new Set<number>([yIni - 1, yIni, yFin]);
  for (const y of years) {
    const start = `${y}-${mdIni}`;
    // Si el mes-día de fin es menor que el de inicio, el bloqueo cruza el año.
    const end = mdFin >= mdIni ? `${y}-${mdFin}` : `${y + 1}-${mdFin}`;
    if (reqInicio <= end && start <= reqFin) return true;
  }
  return false;
}
