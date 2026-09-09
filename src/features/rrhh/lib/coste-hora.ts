/**
 * Coste de una hora de trabajo.
 *
 * Vive aparte (sin `server-only`) porque lo necesitan tanto el servidor —al
 * copiar las condiciones del puesto al empleado y al calcular los ratios— como
 * la pantalla donde se edita el puesto, para enseñar la cifra sugerida.
 */

/**
 * Cómo se le paga a un puesto.
 *
 * `MENSUAL`: cobra un sueldo fijo al mes, trabaje las horas que trabaje. Es el
 * caso normal de plantilla.
 *
 * `HORAS`: cobra por hora trabajada (músicos, cantantes, extras). No tiene
 * sueldo mensual ni horas semanales: si un mes no trabaja, no cobra. Por eso
 * tampoco genera coste de vacaciones.
 */
export type ModoPago = "MENSUAL" | "HORAS";

export const ETIQUETA_MODO_PAGO: Record<ModoPago, string> = {
  MENSUAL: "Sueldo fijo al mes",
  HORAS: "Por hora trabajada",
};

/** Qué significa el salario bruto en cada modo. */
export const ETIQUETA_SALARIO: Record<ModoPago, string> = {
  MENSUAL: "Salario bruto mensual (€)",
  HORAS: "Precio bruto por hora (€)",
};

/**
 * Precio de la hora según cómo se pague el puesto.
 *
 * En `HORAS` el salario bruto YA ES el precio de la hora: no hay nada que
 * repartir. En `MENSUAL` se reparte el sueldo entre las horas de la jornada.
 */
export function costeHoraSegunModo(
  modo: ModoPago,
  salarioBruto: number | null | undefined,
  horasSemanales: number | null | undefined,
): number | null {
  if (modo === "HORAS") {
    return salarioBruto && salarioBruto > 0 ? salarioBruto : null;
  }
  return costeHoraDe(salarioBruto, horasSemanales);
}

/**
 * Precio de la hora a partir del sueldo mensual bruto y la jornada semanal:
 * bruto × 12 meses ÷ (52 semanas × horas de la semana).
 *
 * Es el respaldo para cuando nadie ha escrito el coste a mano. Devuelve `null`
 * si falta algún dato: sin sueldo o sin jornada no hay coste que calcular, y un
 * 0 se leería como "esta hora es gratis".
 */
export function costeHoraDe(
  salarioBruto: number | null | undefined,
  horasSemanales: number | null | undefined,
): number | null {
  if (!salarioBruto || !horasSemanales) return null;
  if (salarioBruto <= 0 || horasSemanales <= 0) return null;
  return (salarioBruto * 12) / (52 * horasSemanales);
}

/**
 * Seguridad Social a cargo de la empresa, en % sobre el bruto, por defecto.
 *
 * El bruto es lo que cobra el trabajador; esto es lo que la empresa paga POR
 * ENCIMA por él. No es un valor de manual: es lo que dan las nóminas ya cargadas
 * (`rrhh_pagos`), donde se mueve de forma muy estable entre el 34,4 % y el
 * 36,6 %. Se redondea a 35 y cada empresa lo ajusta en Ajustes → RRHH.
 */
export const SS_EMPRESA_PCT_DEFECTO = 35;

/** Pasa un coste en bruto a coste REAL de empresa, sumándole su cotización. */
export function conSeguridadSocial(coste: number, ssPct: number): number {
  if (!Number.isFinite(coste) || coste <= 0) return 0;
  const pct = Number.isFinite(ssPct) && ssPct >= 0 ? ssPct : SS_EMPRESA_PCT_DEFECTO;
  return coste * (1 + pct / 100);
}
