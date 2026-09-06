/**
 * Ratios de coste de personal.
 *
 * Responde a una pregunta: cuánto nos cuesta la plantilla y qué parte de lo que
 * facturamos se va en ella. Todo sale de datos reales: las horas de los fichajes
 * y el salario del puesto; la facturación, de los tickets cobrados.
 */

/**
 * Cada cuánto se agrupa el resultado. Coincide con los modos del selector de
 * periodo compartido (`CalendarRangeMode`) para no tener dos vocabularios.
 */
export type PeriodoRatios = "DIARIO" | "SEMANAL" | "MENSUAL" | "TRIMESTRAL" | "ANUAL";

/** Modos que ofrece Ratios (el selector compartido admite también SEMESTRAL). */
export const MODOS_RATIOS: PeriodoRatios[] = [
  "DIARIO",
  "SEMANAL",
  "MENSUAL",
  "TRIMESTRAL",
  "ANUAL",
];

/**
 * De dónde sale el coste de personal.
 *
 * `NOMINA` es el dato real: lo que consta en la nómina más su Seguridad Social.
 * Solo existe cuando el mes está cerrado y la gestoría ha subido los pagos.
 *
 * `ESTIMACION` calcula sobre las horas fichadas y el precio de la hora. Es
 * aproximado, pero sirve para ver cómo va el mes en curso sin esperar al cierre.
 */
export type ModoCoste = "NOMINA" | "ESTIMACION";

export const ETIQUETA_MODO: Record<ModoCoste, string> = {
  NOMINA: "Pagos reales",
  ESTIMACION: "Estimación",
};

/** Las dos áreas del negocio: quien da el servicio y quien lo sostiene. */
export type AreaRatios = "OPERATIVA" | "ADMINISTRATIVA";

export const ETIQUETA_AREA: Record<AreaRatios, string> = {
  OPERATIVA: "Operativa",
  ADMINISTRATIVA: "Administrativa",
};

/** Una fila de agrupación: sirve igual para área, departamento y puesto. */
export interface FilaRatio {
  clave: string;
  nombre: string;
  /** Solo en puestos y departamentos: a qué área pertenece. */
  area: AreaRatios | null;
  /** Solo en puestos: de qué departamento cuelga. */
  departamento: string | null;
  horas: number;
  coste: number;
  /** Personas distintas que han fichado en el periodo. */
  personas: number;
  /** Qué parte del coste total de personal se va en esta fila. */
  pctSobreCoste: number;
  /** Qué parte de la facturación se va en esta fila. */
  pctSobreFacturacion: number;
}

/**
 * Ausencias que se pagan: no se ficha, pero la nómina llega igual.
 *
 * Se cuentan por los DÍAS REALES de cada persona, no repartiendo una media por
 * todo el año: si alguien tiene 7 días, esos 7 días es cuando cuestan.
 */
export type TipoAusencia = "vacaciones" | "permiso" | "baja_medica" | "otra";

export const ETIQUETA_AUSENCIA: Record<TipoAusencia, string> = {
  vacaciones: "Vacaciones",
  permiso: "Permisos",
  baja_medica: "Bajas médicas",
  otra: "Otras ausencias",
};

export interface CosteAusencia {
  tipo: TipoAusencia;
  dias: number;
  personas: number;
  coste: number;
}

/** Un punto de la serie: un día, una semana, un mes, un trimestre o un año. */
export interface PuntoRatio {
  /** Clave interna ordenable (2026-09-05, 2026-W36, 2026-09, 2026-T3, 2026). */
  clave: string;
  /** Cómo se enseña en pantalla, ya en día/mes/año cuando toca. */
  etiqueta: string;
  horas: number;
  /** Coste de las horas efectivamente trabajadas. */
  coste: number;
  /** Coste de quien ese día estaba de vacaciones, de permiso o de baja. */
  costeAusencias: number;
  /** Trabajado + ausencias: lo que de verdad cuesta la plantilla ese día. */
  costeTotal: number;
  facturacion: number;
  /** Coste de personal (total) sobre facturación, en porcentaje. */
  pctCostePersonal: number | null;
}

export interface ResumenRatios {
  horas: number;
  /** Coste de las horas trabajadas. */
  coste: number;
  /** Coste de las ausencias pagadas del periodo. */
  costeAusencias: number;
  /** Trabajado + ausencias. Es el numerador del % de coste de personal. */
  costeTotal: number;
  facturacion: number;
  pctCostePersonal: number | null;
  personas: number;
  /** Coste medio de la hora trabajada en el periodo (ya con Seguridad Social). */
  costeHoraMedio: number;
  /** % de Seguridad Social de empresa aplicado (Ajustes → RRHH). */
  seguridadSocialPct: number;
}

/**
 * Proyección de cómo puede acabar el mes.
 *
 * La facturación que falta se estima con la media de cada día de la semana: un
 * sábado factura tres veces más que un lunes, así que una media plana engañaría.
 */
export interface Proyeccion {
  /** Días del mes ya transcurridos y días que quedan. */
  diasTranscurridos: number;
  diasRestantes: number;
  facturacionReal: number;
  facturacionEstimadaRestante: number;
  facturacionProyectada: number;
  costeProyectado: number;
  pctProyectado: number | null;
  /** Cuántos días de histórico sostienen la previsión. Pocos = poco fiable. */
  diasHistorico: number;
}

export interface RatiosDashboard {
  rango: { from: string; to: string };
  periodo: PeriodoRatios;
  /** Cómo se ha calculado el coste que se está enseñando. */
  modo: ModoCoste;
  /** Si se pidió NOMINA pero no había pagos cargados, se cae a estimación y se dice. */
  modoSolicitado: ModoCoste;
  /** Proyección a fin de mes. Solo cuando el rango es un mes aún en curso. */
  proyeccion: Proyeccion | null;
  resumen: ResumenRatios;
  serie: PuntoRatio[];
  porArea: FilaRatio[];
  porDepartamento: FilaRatio[];
  porPuesto: FilaRatio[];
  /** Desglose de lo que cuesta no trabajar: vacaciones, permisos y bajas. */
  ausencias: CosteAusencia[];
  /**
   * Aviso de cobertura: gente que ha fichado y de la que NO sabemos el coste
   * (sin puesto asignado o sin salario). Sus horas cuentan, su coste no, así que
   * el total sale corto y hay que decirlo.
   */
  cobertura: {
    empleadosSinCoste: number;
    horasSinCoste: number;
    nombresSinCoste: string[];
    /** Empleados cuyo coste sale del salario del PUESTO por no tener condiciones propias. */
    empleadosConSalarioDePuesto: number;
  };
}
