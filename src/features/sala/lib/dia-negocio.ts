/**
 * Día de negocio de un restaurante.
 *
 * REGLA (decisión del dueño): el día NO cambia a medianoche, cambia a las
 * 06:00. Una reserva de las 01:30 del sábado pertenece al servicio del
 * VIERNES, porque es la misma noche: el cliente reservó "para el viernes" y
 * así es como lo vive la sala.
 *
 * El corte está en las 06:00 porque hay locales de noche que cierran a esa
 * hora, pero NINGUNO abre antes: cualquier hora anterior pertenece siempre al
 * servicio de la noche anterior.
 *
 * Aplica a todas las empresas por igual — no es configurable a propósito: un
 * corte distinto por local haría que la misma hora significara días distintos
 * según dónde, y eso rompe cualquier comparación entre locales.
 */

/** Hora (0-23) en la que empieza un día de negocio nuevo. */
export const HORA_CORTE_DIA_NEGOCIO = 6;

/**
 * Día de negocio al que pertenece una (fecha, hora) civil.
 *
 * `2026-08-22 01:30` → `2026-08-21` (madrugada del sábado = servicio del viernes)
 * `2026-08-22 13:00` → `2026-08-22`
 */
export function diaNegocioDe(fecha: string, hora: string): string {
  const h = parseInt(hora.slice(0, 2), 10);
  if (Number.isNaN(h) || h >= HORA_CORTE_DIA_NEGOCIO) return fecha;
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return isoDe(d);
}

/**
 * Fecha civil real de una hora dentro de un día de negocio.
 *
 * Inversa de `diaNegocioDe`: el servicio del viernes a las 01:30 ocurre de
 * hecho el sábado.
 */
export function fechaCivilDe(diaNegocio: string, hora: string): string {
  const h = parseInt(hora.slice(0, 2), 10);
  if (Number.isNaN(h) || h >= HORA_CORTE_DIA_NEGOCIO) return diaNegocio;
  const d = new Date(`${diaNegocio}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return isoDe(d);
}

/**
 * Turno al que pertenece una hora.
 *
 * La madrugada es CENA, no comida: una reserva de las 00:30 es la cena de la
 * noche anterior que se ha alargado. Antes se calculaba con `hora < 17` a
 * secas, así que las 00:30 caían en COMIDA y sus comensales se descontaban del
 * cupo equivocado — y a Google le llegaba el turno mal.
 *
 * Franja: [06:00, 18:00) → COMIDA · [18:00, 06:00) → CENA.
 */
export function turnoDeHora(hora: string): "COMIDA" | "CENA" {
  const h = parseInt(hora.slice(0, 2), 10);
  if (Number.isNaN(h)) return "CENA";
  return h >= HORA_CORTE_DIA_NEGOCIO && h < 18 ? "COMIDA" : "CENA";
}

/** true si esa hora cae en la madrugada que aún pertenece al día anterior. */
export function esMadrugadaDelDiaAnterior(hora: string): boolean {
  const h = parseInt(hora.slice(0, 2), 10);
  return !Number.isNaN(h) && h < HORA_CORTE_DIA_NEGOCIO;
}

function isoDe(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
