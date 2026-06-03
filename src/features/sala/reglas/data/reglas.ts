/**
 * Reglas con vigencia para aforo (cupo) y tamaño máximo (maxpax) por reserva.
 * Sustituye el modelo plano de 28 columnas día×métrica×turno por reglas
 * declarativas con vigencia. La misma forma se reusa en planos (qué plano
 * aplica) — los planos guardan los campos en su propia tabla.
 *
 * Convención días: ISODOW (1=lunes ... 7=domingo).
 */

export type MetricaRegla = "cupo" | "maxpax";
export const METRICAS_REGLA: MetricaRegla[] = ["cupo", "maxpax"];

export type TurnoRegla = "COMIDA" | "CENA" | "AMBOS";
export const TURNOS_REGLA: TurnoRegla[] = ["COMIDA", "CENA", "AMBOS"];

export const TURNO_REGLA_LABELS: Record<TurnoRegla, string> = {
  COMIDA: "Comida",
  CENA: "Cena",
  AMBOS: "Comida y cena",
};

/** ISODOW: 1=lunes ... 7=domingo. */
export type DiaIsoDow = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DIAS_ISO_DOW: DiaIsoDow[] = [1, 2, 3, 4, 5, 6, 7];
export const DIA_ISO_DOW_LABELS: Record<DiaIsoDow, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};
export const DIA_ISO_DOW_LABELS_CORTOS: Record<DiaIsoDow, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

/**
 * Modo de vigencia exclusivo. Una regla pertenece a exactamente uno de estos
 * modos — el `<VigenciaSelector />` se encarga de mapear el modo a los campos
 * correctos (fecha_desde / dias_semana / fechas_extra).
 *
 * - "siempre"          → ningún campo de vigencia (regla general)
 * - "hoy"              → fechas_extra = [hoy]
 * - "todos_los_dia"    → dias_semana = [N]
 * - "todos_los_dias"   → dias_semana = [1..7]
 * - "rango"            → fecha_desde + fecha_hasta
 * - "fechas"           → fechas_extra = [date, date, ...]
 */
export type ModoVigencia =
  | "siempre"
  | "hoy"
  | "todos_los_dia"
  | "todos_los_dias"
  | "rango"
  | "fechas";

/** Forma "intencional" usada por el selector — luego se serializa a campos. */
export interface VigenciaSpec {
  modo: ModoVigencia;
  /** Para "todos_los_dia": qué día de la semana. */
  diaSemana?: DiaIsoDow;
  /** Para "rango". */
  fechaDesde?: string;
  fechaHasta?: string;
  /** Para "hoy" y "fechas". */
  fechas?: string[];
}

export interface EmpresaReservasRegla {
  id: string;
  empresaId: string;
  metrica: MetricaRegla;
  valor: number;
  turno: TurnoRegla;
  fechaDesde: string | null;
  fechaHasta: string | null;
  diasSemana: number[] | null;
  fechasExtra: string[] | null;
  prioridad: number;
  nombre: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input para crear/actualizar una regla desde la UI. */
export interface ReglaInput {
  metrica: MetricaRegla;
  valor: number;
  turno: TurnoRegla;
  vigencia: VigenciaSpec;
  nombre?: string | null;
  prioridad?: number;
}

/**
 * Mapeo desde fila SQL (snake_case) a tipo TS (camelCase).
 */
export interface ReglaRow {
  id: string;
  empresa_id: string;
  metrica: MetricaRegla;
  valor: number;
  turno: TurnoRegla;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  dias_semana: number[] | null;
  fechas_extra: string[] | null;
  prioridad: number;
  nombre: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export function rowToRegla(r: ReglaRow): EmpresaReservasRegla {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    metrica: r.metrica,
    valor: r.valor,
    turno: r.turno,
    fechaDesde: r.fecha_desde,
    fechaHasta: r.fecha_hasta,
    diasSemana: r.dias_semana,
    fechasExtra: r.fechas_extra,
    prioridad: r.prioridad,
    nombre: r.nombre,
    activo: r.activo,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Forma mínima para derivar la vigencia: cualquier entidad que persista los
 * mismos 4 campos puede pasarse (cupo/maxpax, reglas de intervalo, etc.).
 */
export interface VigenciaSource {
  fechaDesde: string | null;
  fechaHasta: string | null;
  diasSemana: number[] | null;
  fechasExtra: string[] | null;
}

/**
 * Deriva el ModoVigencia desde una regla persistida (para precargar el modal
 * al editar).
 */
export function reglaToVigencia(r: VigenciaSource): VigenciaSpec {
  if (r.fechasExtra && r.fechasExtra.length === 1) {
    const hoyISO = new Date().toISOString().slice(0, 10);
    if (r.fechasExtra[0] === hoyISO) return { modo: "hoy", fechas: r.fechasExtra };
    return { modo: "fechas", fechas: r.fechasExtra };
  }
  if (r.fechasExtra && r.fechasExtra.length > 1) {
    return { modo: "fechas", fechas: r.fechasExtra };
  }
  if (r.fechaDesde && r.fechaHasta) {
    return { modo: "rango", fechaDesde: r.fechaDesde, fechaHasta: r.fechaHasta };
  }
  if (r.diasSemana && r.diasSemana.length === 7) {
    return { modo: "todos_los_dias" };
  }
  if (r.diasSemana && r.diasSemana.length === 1) {
    return { modo: "todos_los_dia", diaSemana: r.diasSemana[0] as DiaIsoDow };
  }
  if (r.diasSemana && r.diasSemana.length > 1) {
    // Caso raro: varios días sueltos. Lo tratamos como "fechas" no aplica.
    // Para el selector lo mostramos como "todos_los_dia" del primer día.
    return { modo: "todos_los_dia", diaSemana: r.diasSemana[0] as DiaIsoDow };
  }
  return { modo: "siempre" };
}

/**
 * Serializa un VigenciaSpec a los campos de BD (fecha_desde, dias_semana, fechas_extra).
 */
export function vigenciaToCampos(v: VigenciaSpec): {
  fechaDesde: string | null;
  fechaHasta: string | null;
  diasSemana: number[] | null;
  fechasExtra: string[] | null;
} {
  switch (v.modo) {
    case "siempre":
      return { fechaDesde: null, fechaHasta: null, diasSemana: null, fechasExtra: null };
    case "hoy": {
      const hoy = new Date().toISOString().slice(0, 10);
      return { fechaDesde: null, fechaHasta: null, diasSemana: null, fechasExtra: [hoy] };
    }
    case "todos_los_dia":
      return {
        fechaDesde: null,
        fechaHasta: null,
        diasSemana: v.diaSemana ? [v.diaSemana] : null,
        fechasExtra: null,
      };
    case "todos_los_dias":
      return {
        fechaDesde: null,
        fechaHasta: null,
        diasSemana: [1, 2, 3, 4, 5, 6, 7],
        fechasExtra: null,
      };
    case "rango":
      return {
        fechaDesde: v.fechaDesde ?? null,
        fechaHasta: v.fechaHasta ?? null,
        diasSemana: null,
        fechasExtra: null,
      };
    case "fechas":
      return {
        fechaDesde: null,
        fechaHasta: null,
        diasSemana: null,
        fechasExtra: v.fechas && v.fechas.length > 0 ? v.fechas : null,
      };
  }
}

/**
 * Convierte JS Date.getDay() (0=domingo..6=sábado) a ISODOW (1=lunes..7=domingo).
 */
export function jsDayToIsoDow(jsDay: number): DiaIsoDow {
  return (jsDay === 0 ? 7 : jsDay) as DiaIsoDow;
}
