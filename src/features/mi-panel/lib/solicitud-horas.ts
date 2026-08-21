/**
 * Regla fija del sistema: las horas de una solicitud (entrada y salida) solo
 * pueden ir en punto o en media. Nada de cuartos ni minutos sueltos.
 *
 * Vive aquí para que cliente y servidor validen exactamente lo mismo.
 */

/** Salto permitido, en minutos, entre horas seleccionables. */
export const SOLICITUD_PASO_MINUTOS = 30;

/** Texto único de la advertencia, para no escribirlo dos veces. */
export const SOLICITUD_HORAS_AVISO =
  "Solo se pueden solicitar horas en punto o y media.";

/** Hora por la que arranca la lista: la jornada del restaurante empieza aquí. */
const SOLICITUD_HORA_INICIO_LISTA = 6;

/**
 * Las 48 horas seleccionables del día, empezando a las 06:00:
 * 06:00, 06:30 … 23:30, 00:00 … 05:30.
 *
 * La madrugada va al final, como continuación de la noche: un turno que entra
 * a las 23:00 y sale a las 03:00 se pide de una vez, no en dos solicitudes.
 */
export const SOLICITUD_HORAS_OPCIONES: string[] = Array.from(
  { length: (24 * 60) / SOLICITUD_PASO_MINUTOS },
  (_, i) => {
    const total =
      (SOLICITUD_HORA_INICIO_LISTA * 60 + i * SOLICITUD_PASO_MINUTOS) % 1440;
    const h = String(Math.floor(total / 60)).padStart(2, "0");
    const m = String(total % 60).padStart(2, "0");
    return `${h}:${m}`;
  },
);

/**
 * Duración máxima de un tramo, en minutos: 16 horas seguidas.
 *
 * Un turno de noche (23:00 → 03:00) y un error de tecleo (12:00 → 11:30) son
 * indistinguibles mirando solo el reloj: en los dos la salida cae "antes" que
 * la entrada. Lo único que los separa es cuánto duran, así que el tope es lo
 * que corta el segundo sin estorbar al primero.
 */
export const SOLICITUD_DURACION_MAX_MINUTOS = 16 * 60;

/**
 * Minutos entre entrada y salida. Si la salida es anterior a la entrada se
 * entiende que el turno acabó de madrugada (23:00 → 03:00 son 4 horas), algo
 * habitual en hostelería, así que se suman las 24 horas.
 */
export function minutosTramo(horaInicio: string, horaFin: string): number {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  let min = hf * 60 + mf - (hi * 60 + mi);
  if (min < 0) min += 1440; // cruza medianoche
  return min;
}

/**
 * Valida el tramo completo. Devuelve el mensaje de error, o null si es válido.
 * Cliente y servidor usan esta misma función para decir exactamente lo mismo.
 */
export function validarTramo(
  horaInicio: string,
  horaFin: string,
): string | null {
  if (!esHoraPermitida(horaInicio) || !esHoraPermitida(horaFin)) {
    return SOLICITUD_HORAS_AVISO;
  }
  const min = minutosTramo(horaInicio, horaFin);
  // No hace falta comprobar el mínimo: si las horas van de media en media y no
  // son la misma, el tramo más corto posible ya es media hora.
  if (min === 0) {
    return "La hora de entrada no puede ser igual a la de salida.";
  }
  if (min > SOLICITUD_DURACION_MAX_MINUTOS) {
    return `Revisa las horas: salen ${(min / 60).toFixed(1).replace(".", ",")} horas y no se pueden solicitar más de ${SOLICITUD_DURACION_MAX_MINUTOS / 60} seguidas.`;
  }
  return null;
}

/** true si "HH:MM" cae en punto o en media. Una hora vacía no es válida. */
export function esHoraPermitida(hora: string | null | undefined): boolean {
  if (!hora) return false;
  const m = /^(\d{2}):(\d{2})$/.exec(hora.trim());
  if (!m) return false;
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) return false;
  return minutos % SOLICITUD_PASO_MINUTOS === 0;
}
