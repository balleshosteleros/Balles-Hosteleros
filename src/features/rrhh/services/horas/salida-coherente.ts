/**
 * La salida de un fichaje nunca es anterior a su entrada.
 *
 * La ENTRADA sí se redondea a la hora del turno (cortesía de Ajustes →
 * Fichajes: `redondearAntes`/`redondearDespues`): quien tiene turno a las 21:30
 * y ficha a las 21:25 queda grabado a las 21:30. La SALIDA no se redondea
 * nunca — vale la hora del botón. Juntando las dos reglas, quien ficha entrada
 * dentro de la cortesía y sale acto seguido dejaba una ficha imposible
 * ("entrada 21:30 / salida 21:29") con horas NEGATIVAS: la tarjeta del día las
 * enseñaba como 0:00 h, pero el total del mes —y Pagos, y los ratios— las
 * restaba de verdad.
 *
 * Regla: la hora oficial de salida es, como pronto, la de entrada (jornada de
 * 0 h) y las horas nunca bajan de 0. El instante exacto en que se pulsó el
 * botón se sigue guardando aparte en `hora_salida_real`.
 */

/** Hora oficial de salida: la del botón, salvo que sea anterior a la entrada. */
export function salidaNoAnterior(
  horaEntrada: string | Date | null | undefined,
  salida: Date,
): Date {
  if (!horaEntrada) return salida;
  const entradaMs = new Date(horaEntrada).getTime();
  if (!Number.isFinite(entradaMs)) return salida;
  return salida.getTime() < entradaMs ? new Date(entradaMs) : salida;
}

/**
 * Horas trabajadas entre entrada y salida, con la pausa descontada. Nunca
 * negativas. `decimales` = precisión con la que se graban en `horas_totales`.
 */
export function horasEntre(
  horaEntrada: string | Date | null | undefined,
  salida: Date,
  opts?: { pausaMs?: number; decimales?: number },
): number {
  if (!horaEntrada) return 0;
  const entradaMs = new Date(horaEntrada).getTime();
  if (!Number.isFinite(entradaMs)) return 0;
  const factor = 10 ** (opts?.decimales ?? 4);
  const pausaMs = Math.max(0, opts?.pausaMs ?? 0);
  const trabajadoMs = salidaNoAnterior(horaEntrada, salida).getTime() - entradaMs - pausaMs;
  return Math.max(0, Math.round((trabajadoMs / 3600000) * factor) / factor);
}
