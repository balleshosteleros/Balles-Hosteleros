/**
 * Coste de una hora de trabajo.
 *
 * Vive aparte (sin `server-only`) porque lo necesitan tanto el servidor —al
 * copiar las condiciones del puesto al empleado y al calcular los ratios— como
 * la pantalla donde se edita el puesto, para enseñar la cifra sugerida.
 */

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
