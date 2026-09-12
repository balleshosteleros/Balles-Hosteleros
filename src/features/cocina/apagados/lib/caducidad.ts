/**
 * Cuánto dura el apagado de un producto agotado.
 *
 * Un plazo en HORAS desde que se marca, no "hasta mañana": así dura lo mismo
 * se marque a las seis de la tarde o a las cinco de la madrugada. Por defecto
 * 12 h, y cada empresa lo ajusta en Cocina → Comandas → configuración.
 *
 * Cálculo puro (sin BD) para poder usarlo igual en el servidor de la carta,
 * en el panel de cocina y en el editor de Marketing: los tres tienen que decir
 * lo mismo, y si cada uno lo calculara a su manera acabarían discrepando.
 */

/** Horas que dura el apagado cuando la empresa no ha configurado otra cosa. */
export const HORAS_APAGADO_DEFAULT = 12;

/** Límites del plazo configurable (los mismos que valida la BD). */
export const HORAS_APAGADO_MIN = 1;
export const HORAS_APAGADO_MAX = 72;

/**
 * ¿Sigue apagado? `agotadoAt` es el instante en que se marcó (UTC).
 * `null` = nunca se marcó, o ya se encendió a mano.
 */
export function apagadoVigente(
  agotadoAt: string | null | undefined,
  horas: number,
  ahora: Date = new Date(),
): boolean {
  if (!agotadoAt) return false;
  const marcado = new Date(agotadoAt).getTime();
  if (Number.isNaN(marcado)) return false;
  return ahora.getTime() - marcado < horasEnMs(horas);
}

/** Cuándo vuelve solo a la carta. `null` si no está apagado. */
export function vuelveEn(
  agotadoAt: string | null | undefined,
  horas: number,
): Date | null {
  if (!agotadoAt) return null;
  const marcado = new Date(agotadoAt).getTime();
  if (Number.isNaN(marcado)) return null;
  return new Date(marcado + horasEnMs(horas));
}

function horasEnMs(horas: number): number {
  const h = Number.isFinite(horas) && horas > 0 ? horas : HORAS_APAGADO_DEFAULT;
  return h * 60 * 60 * 1000;
}

/** Normaliza lo que llegue de la BD o de un formulario. */
export function horasApagadoSeguras(valor: unknown): number {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n) || n < HORAS_APAGADO_MIN || n > HORAS_APAGADO_MAX) {
    return HORAS_APAGADO_DEFAULT;
  }
  return n;
}
