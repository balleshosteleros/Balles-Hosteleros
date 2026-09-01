/**
 * CUARTOS DE HORA — única granularidad válida para la hora de una reserva.
 *
 * En sala no se sienta a nadie a las 12:07. El servicio se organiza en cuartos
 * (00, 15, 30 y 45) porque de ahí cuelga todo lo demás: los slots del turno,
 * el cálculo de solapes, el aforo por franja y los avisos de mesa. Una reserva
 * a las 12:07 no cae en ninguna franja, así que no la protege ningún cálculo:
 * ni pisa, ni la pisan, y la mesa se dobla sin que nadie avise.
 *
 * El portal público ya lo validaba (`motor-web-validar`), pero el back-office
 * no: se podía teclear cualquier minuto al crear o al editar. Aquí vive la
 * regla, una sola vez, para que la cumplan por igual la UI y el servidor.
 */

import { RESERVA_SLOT_MIN } from "@/features/sala/data/reservas";

/** Los cuatro minutos válidos, en el orden en que se leen. */
export const MINUTOS_VALIDOS_RESERVA = [0, 15, 30, 45] as const;

/** "12:07:00" → 727. Devuelve null si no es una hora legible. */
function minutosDeHora(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((hora ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** 727 → "12:07". */
function horaDeMinutos(total: number): string {
  const norm = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** ¿Cae la hora justo en un cuarto? Una hora ilegible NO es válida. */
export function esHoraEnCuarto(hora: string): boolean {
  const min = minutosDeHora(hora);
  if (min == null) return false;
  return min % RESERVA_SLOT_MIN === 0;
}

/**
 * Lleva una hora al cuarto MÁS CERCANO ("12:07" → "12:00", "12:08" → "12:15").
 *
 * Se redondea en vez de rechazar porque el usuario que teclea 12:07 quiere una
 * hora cercana, no un error: se le corrige el dato y se le dice qué quedó.
 * Devuelve null si la hora no se puede leer.
 */
export function redondearACuarto(hora: string): string | null {
  const min = minutosDeHora(hora);
  if (min == null) return null;
  return horaDeMinutos(Math.round(min / RESERVA_SLOT_MIN) * RESERVA_SLOT_MIN);
}

/** Mensaje único para toda la app: la regla se explica siempre igual. */
export const MENSAJE_HORA_CUARTO =
  `Las reservas van en intervalos de ${RESERVA_SLOT_MIN} minutos: solo :00, :15, :30 y :45.`;
