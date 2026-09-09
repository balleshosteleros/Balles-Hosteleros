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

import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
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

/**
 * Hora de AHORA MISMO, ya llevada al cuarto más cercano, en la zona de la
 * empresa. Es la hora con la que nace todo walk-in.
 *
 * Un walk-in es gente que ya está en la puerta: su hora es siempre "ahora", así
 * que no se le pregunta. Antes había que elegirla a mano con el cliente delante,
 * y cualquier despiste dejaba la mesa apuntada a una hora que no era.
 *
 * El reloj es el de la EMPRESA, no el del ordenador de quien da el alta: desde
 * otra zona horaria el navegador diría una hora que en el restaurante no es esa.
 *
 * Pasadas las 23:53 el redondeo cae en "00:00", que es lo correcto: sigue siendo
 * el mismo día de negocio (el corte está en las 06:00).
 */
export function horaAhoraEnCuarto(tz: string, instante: Date = new Date()): string {
  const { minutos } = ahoraEnZona(tz, instante);
  const hh = String(Math.floor(minutos / 60)).padStart(2, "0");
  const mm = String(minutos % 60).padStart(2, "0");
  return redondearACuarto(`${hh}:${mm}`) ?? `${hh}:00`;
}
