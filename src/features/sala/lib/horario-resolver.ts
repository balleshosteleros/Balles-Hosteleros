import type {
  EmpresaReservasConfig,
  EmpresaReservasHorarioExcepcion,
  TurnoKey,
  DiaSemanaKey,
  SlotsPorDiaKey,
} from "@/features/sala/data/reservas";
import { DIA_SEMANA_KEY } from "@/features/sala/data/reservas";

/**
 * Resolución de horario de reservas para (fecha, turno) con la precedencia
 * acordada con el usuario (más específico gana):
 *
 *   1. Días específicos        (excepción ambito='dias_especificos' cuya lista incluya `fecha`)
 *   2. Entre dos fechas        (excepción ambito='rango' donde `fecha` cae dentro)
 *   3. Patrón semanal por día  (columnas <dia>_inicio_<turno> / <dia>_fin_<turno> / <dia>_cerrado_<turno>)
 *   4. Horario general         (general_inicio_<turno> / general_fin_<turno> / general_cerrado_<turno>)
 *
 * También respetamos un quinto caso intermedio: ambito='fecha' equivale en
 * precedencia a 'dias_especificos' (es decir, prevalece sobre rango y semanal),
 * porque una fecha puntual es máxima especificidad.
 */

export type FuenteHorario =
  | "dias_especificos"
  | "fecha"
  | "rango"
  | "semanal"
  | "general"
  | "sin_definir";

export interface HorarioResuelto {
  cerrado: boolean;
  inicio: string | null;
  fin: string | null;
  fuente: FuenteHorario;
  motivo: string | null;
}

function diaSemanaDeISO(fecha: string): DiaSemanaKey {
  const [y, m, d] = fecha.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DIA_SEMANA_KEY[dow];
}

function dentroDeRango(fecha: string, ini: string, fin: string): boolean {
  return fecha >= ini && fecha <= fin;
}

export function resolveHorarioReservas(
  fecha: string,
  turno: TurnoKey,
  config: EmpresaReservasConfig,
  excepciones: EmpresaReservasHorarioExcepcion[],
): HorarioResuelto {
  const aplicables = excepciones.filter((e) => e.turno === turno);

  // 1) Días específicos
  const porLista = aplicables.find(
    (e) => e.ambito === "dias_especificos" && (e.fechas ?? []).includes(fecha),
  );
  if (porLista) {
    return {
      cerrado: porLista.cerrado,
      inicio: porLista.inicio,
      fin: porLista.fin,
      fuente: "dias_especificos",
      motivo: porLista.motivo,
    };
  }

  // 1bis) Fecha puntual (alias del más específico)
  const porFecha = aplicables.find((e) => e.ambito === "fecha" && e.fecha === fecha);
  if (porFecha) {
    return {
      cerrado: porFecha.cerrado,
      inicio: porFecha.inicio,
      fin: porFecha.fin,
      fuente: "fecha",
      motivo: porFecha.motivo,
    };
  }

  // 2) Entre dos fechas
  const porRango = aplicables.find(
    (e) =>
      e.ambito === "rango" &&
      e.fechaInicio != null &&
      e.fechaFin != null &&
      dentroDeRango(fecha, e.fechaInicio, e.fechaFin),
  );
  if (porRango) {
    return {
      cerrado: porRango.cerrado,
      inicio: porRango.inicio,
      fin: porRango.fin,
      fuente: "rango",
      motivo: porRango.motivo,
    };
  }

  // 3) Patrón semanal del día
  const dia = diaSemanaDeISO(fecha);
  const cerradoDia = config[`${dia}_cerrado_${turno}` as const];
  const inicioDia  = config[`${dia}_inicio_${turno}`  as const];
  const finDia     = config[`${dia}_fin_${turno}`     as const];
  if (cerradoDia === true || inicioDia != null || finDia != null) {
    return {
      cerrado: cerradoDia === true,
      inicio: cerradoDia ? null : (inicioDia ?? null),
      fin:    cerradoDia ? null : (finDia    ?? null),
      fuente: "semanal",
      motivo: null,
    };
  }

  // 4) General de empresa
  const genCerrado = turno === "comida" ? config.generalCerradoComida : config.generalCerradoCena;
  const genInicio  = turno === "comida" ? config.generalInicioComida  : config.generalInicioCena;
  const genFin     = turno === "comida" ? config.generalFinComida     : config.generalFinCena;
  if (genCerrado || genInicio != null || genFin != null) {
    return {
      cerrado: genCerrado,
      inicio: genCerrado ? null : (genInicio ?? null),
      fin:    genCerrado ? null : (genFin    ?? null),
      fuente: "general",
      motivo: null,
    };
  }

  return { cerrado: false, inicio: null, fin: null, fuente: "sin_definir", motivo: null };
}

/**
 * Pases (slots de 15 min) APAGADOS en una fecha concreta.
 *
 * Misma precedencia que el horario, y por el mismo motivo: si el horario de un
 * día se puede separar del general, la rejilla de pases también tiene que
 * poder, o el tope real del día lo acaba marcando una lista común a los siete
 * y no hay forma de que el viernes llegue más tarde que el martes.
 *
 *   1. Excepción que cubra la fecha (días sueltos › fecha › rango), si trae
 *      lista propia. `slotsInactivos = null` significa "no cambio los pases",
 *      así que se sigue bajando.
 *   2. Rejilla propia del día de la semana (`slotsInactivosPorDia`).
 *   3. Rejilla común del turno (`generalSlotsInactivos*`).
 *
 * Devuelve siempre horas en HH:MM, que es como se comparan los slots.
 */
export function resolveSlotsInactivosReservas(
  fecha: string,
  turno: TurnoKey,
  config: EmpresaReservasConfig,
  excepciones: EmpresaReservasHorarioExcepcion[],
): Set<string> {
  const aHoras = (lista: readonly string[]): Set<string> =>
    new Set(lista.map((s) => s.slice(0, 5)));

  const aplicables = excepciones.filter((e) => e.turno === turno);
  const excepcion =
    aplicables.find(
      (e) => e.ambito === "dias_especificos" && (e.fechas ?? []).includes(fecha),
    ) ??
    aplicables.find((e) => e.ambito === "fecha" && e.fecha === fecha) ??
    aplicables.find(
      (e) =>
        e.ambito === "rango" &&
        e.fechaInicio != null &&
        e.fechaFin != null &&
        dentroDeRango(fecha, e.fechaInicio, e.fechaFin),
    );
  if (excepcion?.slotsInactivos != null) return aHoras(excepcion.slotsInactivos);

  const dia = diaSemanaDeISO(fecha);
  const propios = config.slotsInactivosPorDia?.[`${dia}_${turno}` as SlotsPorDiaKey];
  if (propios != null) return aHoras(propios);

  return aHoras(
    (turno === "comida"
      ? config.generalSlotsInactivosComida
      : config.generalSlotsInactivosCena) ?? [],
  );
}
