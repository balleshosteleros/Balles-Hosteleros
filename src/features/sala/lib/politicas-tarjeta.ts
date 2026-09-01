/**
 * Políticas de tarjeta (PRP-082): única fuente de verdad sobre si una reserva
 * exige tarjeta, cuánto y por qué.
 *
 * Hay DOS políticas, con la misma forma pero distinto rigor:
 *
 *   · CANCELACIÓN — guarda la tarjeta y cobra si el cliente no aparece. No
 *     aparta dinero, así que el cobro puede fallar por falta de fondos.
 *   · GARANTÍA — retiene el importe por adelantado. El dinero está apartado,
 *     así que el cobro no falla, pero la retención caduca (5 días con Visa).
 *
 * Son independientes: una reserva puede llevar las dos a la vez.
 *
 * Lo usan los sitios por los que entra una reserva —portal público, alta
 * manual en Sala y motor de Google— para que todos decidan igual. El importe
 * se congela en la reserva al crearla: si mañana cambia la configuración, la
 * reserva conserva lo que se le dijo al cliente en su correo.
 *
 * Esta fase NO cobra ni retiene nada: marca la reserva y calcula el importe.
 * La tarjeta llega en la fase 2.
 */

import {
  DIA_SEMANA_KEY,
  type DiaSemanaKey,
  type GarantiaModo,
} from "@/features/sala/data/reservas";

/** Las dos políticas se calculan igual; solo cambia de dónde salen los datos. */
export type TipoPolitica = "cancelacion" | "garantia";

/**
 * Condiciones que deciden CUÁNDO se pide tarjeta.
 *
 * Cada eje vacío no restringe, y todos se cumplen a la vez: "sábados" + "8
 * personas" pide tarjeta el sábado con 8 o más comensales, no el sábado de 2.
 * La única excepción es `fechas`, que entra por su cuenta (ver `calcular`).
 */
export interface PoliticaTarjeta {
  activa: boolean;
  /** Importe base en euros. */
  importeEur: number;
  /** Fijo por reserva, o multiplicado por comensal. */
  modo: GarantiaModo;
  /** Comensales a partir de los cuales aplica. 0 = sin mínimo. */
  desdePax: number;
  /** Días de la semana en los que aplica. Vacío = todos. */
  diasSemana: DiaSemanaKey[];
  /** Fechas "YYYY-MM-DD" que exigen tarjeta siempre. Vacío = ninguna. */
  fechas: string[];
  /** Turnos en los que aplica. Vacío = todos. */
  turnos: string[];
  /** Franja horaria "HH:MM". null = sin límite por ese lado. */
  horaDesde: string | null;
  horaHasta: string | null;
  /** Zonas comerciales en las que aplica. Vacío = todas. */
  grupoZonaIds: string[];
  /** Mesas concretas que la exigen. Vacío = todas. */
  mesaIds: string[];
  /**
   * Plazo mínimo de aviso, en horas: con cuánta antelación tiene que cancelar
   * el cliente para NO pagar. Decide si un cobro procede (ver `procedeCobro`).
   */
  horasAntes: number;
}

/** Datos de la reserva que se contrastan con las condiciones. */
export interface ReservaParaPolitica {
  personas: number;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:MM" o "HH:MM:SS" */
  hora: string;
  turno?: string | null;
  grupoZonaId?: string | null;
  mesaId?: string | null;
}

export interface PoliticaCalculada {
  /** true si esta reserva debe llevar la política. */
  aplica: boolean;
  /** Importe total, ya multiplicado si el modo es por comensal. */
  importe: number;
}

const NO_APLICA: PoliticaCalculada = { aplica: false, importe: 0 };

/** "HH:MM(:SS)" → minutos desde medianoche. null si no es una hora válida. */
function aMinutos(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Día de la semana de una fecha "YYYY-MM-DD", sin pasar por `new Date(str)`,
 * que interpreta la cadena en UTC y puede devolver el día anterior según la
 * zona del servidor. Aquí la fecha es un día de calendario del restaurante,
 * no un instante: se calcula con el algoritmo de Sakamoto.
 */
function diaSemanaDeFecha(fecha: string): DiaSemanaKey | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;

  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = mes < 3 ? y - 1 : y;
  const indice =
    (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[mes - 1] + d) % 7;
  // `DIA_SEMANA_KEY` va indexado igual que `Date.getDay()`: 0 = domingo.
  return DIA_SEMANA_KEY[indice] ?? null;
}

/**
 * Decide si una reserva lleva esta política y por cuánto.
 *
 * Devuelve `aplica: false` cuando la política está apagada, cuando la reserva
 * no cumple alguna condición, o cuando el importe resultante no es positivo
 * (una garantía de 0 € no es una garantía).
 */
export function calcularPolitica(
  politica: PoliticaTarjeta | null | undefined,
  reserva: ReservaParaPolitica,
): PoliticaCalculada {
  if (!politica?.activa) return NO_APLICA;

  const base = Number(politica.importeEur);
  if (!Number.isFinite(base) || base <= 0) return NO_APLICA;

  const pax = Number.isFinite(reserva.personas)
    ? Math.max(0, Math.trunc(reserva.personas))
    : 0;

  // Una fecha marcada a mano (Nochevieja) exige tarjeta por sí sola: se puso
  // ahí precisamente para saltarse el resto de reglas del calendario. El
  // mínimo de comensales sí se sigue respetando.
  const fechaMarcada = politica.fechas.includes(reserva.fecha);

  if (politica.desdePax > 0 && pax < politica.desdePax) return NO_APLICA;

  if (!fechaMarcada) {
    if (politica.diasSemana.length > 0) {
      const dia = diaSemanaDeFecha(reserva.fecha);
      if (!dia || !politica.diasSemana.includes(dia)) return NO_APLICA;
    }

    if (politica.turnos.length > 0) {
      const turno = (reserva.turno ?? "").trim().toUpperCase();
      const permitidos = politica.turnos.map((t) => t.trim().toUpperCase());
      if (!turno || !permitidos.includes(turno)) return NO_APLICA;
    }

    const minutos = aMinutos(reserva.hora);
    const desde = aMinutos(politica.horaDesde);
    const hasta = aMinutos(politica.horaHasta);
    if (desde !== null && (minutos === null || minutos < desde)) return NO_APLICA;
    if (hasta !== null && (minutos === null || minutos > hasta)) return NO_APLICA;
  }

  // Zona y mesa se comprueban SIEMPRE, también en una fecha marcada: si la
  // política es solo del reservado, no la exige toda la sala en Nochevieja.
  if (politica.grupoZonaIds.length > 0) {
    if (!reserva.grupoZonaId || !politica.grupoZonaIds.includes(reserva.grupoZonaId)) {
      return NO_APLICA;
    }
  }

  if (politica.mesaIds.length > 0) {
    if (!reserva.mesaId || !politica.mesaIds.includes(reserva.mesaId)) {
      return NO_APLICA;
    }
  }

  const bruto = politica.modo === "comensal" ? base * pax : base;
  // Céntimos exactos: el importe va a un correo y a una tarjeta.
  const importe = Math.round(bruto * 100) / 100;
  if (importe <= 0) return NO_APLICA;

  return { aplica: true, importe };
}

/** Por qué procede cobrar. */
export type MotivoCobro = "no_show" | "cancelacion_fuera_plazo";

export interface ProcedeCobro {
  procede: boolean;
  motivo: MotivoCobro | null;
  /** Horas que faltaban para la reserva al cancelar. null en un no-show. */
  horasDeAviso: number | null;
}

const NO_PROCEDE: ProcedeCobro = { procede: false, motivo: null, horasDeAviso: null };

/**
 * Decide si procede cobrar cuando una reserva se marca como no presentada o
 * cancelada (PRP-082 §5.7).
 *
 *   · No presentado → SIEMPRE procede: no aparecer no tiene plazo que valga.
 *   · Cancelada     → solo si se canceló con menos antelación que el plazo
 *                     mínimo de aviso de la política.
 *
 * `instanteReservaMs` es el momento de la reserva en milisegundos UTC, ya
 * resuelto en la zona horaria de la empresa por quien llama: aquí no se puede
 * calcular, porque una fecha y una hora sin zona no son un instante.
 */
export function procedeCobro(
  politica: PoliticaTarjeta | null | undefined,
  estado: "NO_PRESENTADO" | "CANCELADA",
  instanteReservaMs: number,
  ahoraMs: number = Date.now(),
): ProcedeCobro {
  if (!politica?.activa) return NO_PROCEDE;

  if (estado === "NO_PRESENTADO") {
    return { procede: true, motivo: "no_show", horasDeAviso: null };
  }

  if (!Number.isFinite(instanteReservaMs)) return NO_PROCEDE;
  const horasDeAviso = (instanteReservaMs - ahoraMs) / 3_600_000;

  // Canceló con MENOS antelación que el plazo → la mesa ya no se pudo
  // revender, así que se cobra. Justo en el límite no se cobra: el plazo se
  // cumple.
  if (horasDeAviso < politica.horasAntes) {
    return {
      procede: true,
      motivo: "cancelacion_fuera_plazo",
      horasDeAviso: Math.max(0, Math.round(horasDeAviso * 10) / 10),
    };
  }

  return { ...NO_PROCEDE, horasDeAviso: Math.round(horasDeAviso * 10) / 10 };
}

const lista = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/**
 * Lee una política desde una fila `empresa_reservas_config` en crudo. El
 * prefijo de las columnas es el propio nombre de la política, así que las dos
 * se leen con el mismo código.
 */
export function politicaDesdeRow(
  row: Record<string, unknown> | null | undefined,
  tipo: TipoPolitica,
): PoliticaTarjeta | null {
  if (!row) return null;
  const p = tipo; // "cancelacion" | "garantia"
  const num = (k: string, def: number) => {
    const v = Number(row[k]);
    return Number.isFinite(v) ? v : def;
  };
  return {
    activa: Boolean(row[`${p}_activa`] ?? (tipo === "cancelacion")),
    importeEur: num(`${p}_importe_eur`, 0),
    modo: ((row[`${p}_modo`] as GarantiaModo | null) ?? "reserva"),
    desdePax: num(`${p}_desde_pax`, 0),
    diasSemana: lista(row[`${p}_dias_semana`]) as DiaSemanaKey[],
    fechas: lista(row[`${p}_fechas`]),
    turnos: lista(row[`${p}_turnos`]),
    horaDesde: (row[`${p}_hora_desde`] as string | null) ?? null,
    horaHasta: (row[`${p}_hora_hasta`] as string | null) ?? null,
    grupoZonaIds: lista(row[`${p}_grupo_zona_ids`]),
    mesaIds: lista(row[`${p}_mesa_ids`]),
    horasAntes: num(`${p}_horas_antes`, 24),
  };
}

/**
 * La de cancelación no tiene columna `cancelacion_modo`: su importe es siempre
 * fijo por reserva. Se normaliza aquí para que las dos compartan el tipo.
 */
export const POLITICA_COLUMNAS_SELECT = [
  // Cancelación
  "cancelacion_activa, cancelacion_importe_eur, cancelacion_horas_antes",
  "cancelacion_desde_pax, cancelacion_dias_semana, cancelacion_fechas",
  "cancelacion_turnos, cancelacion_hora_desde, cancelacion_hora_hasta",
  "cancelacion_grupo_zona_ids, cancelacion_mesa_ids",
  // Garantía
  "garantia_activa, garantia_importe_eur, garantia_modo, garantia_horas_antes",
  "garantia_desde_pax, garantia_dias_semana, garantia_fechas",
  "garantia_turnos, garantia_hora_desde, garantia_hora_hasta",
  "garantia_grupo_zona_ids, garantia_mesa_ids",
].join(", ");
