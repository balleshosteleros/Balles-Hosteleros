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

/** Duración mínima de un tramo solicitado, en minutos: media hora. */
export const SOLICITUD_DURACION_MIN_MINUTOS = 30;

/** Hora por la que arranca la lista: la jornada del restaurante empieza aquí. */
const SOLICITUD_HORA_INICIO_LISTA = 6;

/**
 * Las 48 horas seleccionables del día, empezando a las 06:00:
 * 06:00, 06:30 … 23:30, 00:00 … 05:30.
 *
 * La madrugada va al final porque es donde termina la jornada del restaurante,
 * pero entrada y salida siempre pertenecen al MISMO día: un turno que acaba
 * pasada la medianoche se pide como dos solicitudes.
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
 * Minutos entre entrada y salida, dentro del mismo día. Es una resta directa:
 * si la salida es anterior a la entrada, sale negativo y el tramo es inválido.
 * No se da la vuelta al reloj: un turno que acaba de madrugada se pide como dos
 * solicitudes, una por cada día.
 */
export function minutosTramo(horaInicio: string, horaFin: string): number {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  return hf * 60 + mf - (hi * 60 + mi);
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
  if (min === 0) {
    return "La hora de entrada no puede ser igual a la de salida.";
  }
  if (min < 0) {
    return "La hora de entrada tiene que ser anterior a la de salida. Si tu turno acabó de madrugada, pide cada día por separado.";
  }
  if (min < SOLICITUD_DURACION_MIN_MINUTOS) {
    return "Tienes que solicitar media hora como mínimo.";
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
