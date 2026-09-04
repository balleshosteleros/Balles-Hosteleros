import type { EstadoReserva, Reserva } from "@/features/sala/data/reservas";
import { DURACION_RESERVA_DEFAULT_MINUTOS } from "@/features/sala/data/reservas";

/**
 * Contador de la columna TIEMPO del listado de reservas.
 *
 * Todo se calcula EN CADA RENDER a partir de la fecha, la hora, la duración y
 * el estado que tiene la reserva en ese momento: no se guarda ningún instante
 * de arranque. Así, mover una reserva de día o de hora recalcula el contador
 * solo, sin arrastrar nada del horario anterior.
 *
 * Las cuatro caras del contador:
 *  - `CUENTA_ATRAS`  (verde): faltan ≤ 3 h para la hora de la reserva.
 *  - `RETRASO`       (rojo):  pasó la hora y el cliente no se ha sentado.
 *  - `OCUPACION`     (azul):  sentada; cuenta desde la HORA DE LA RESERVA, no
 *                             desde el momento en que se pulsó "Sentada".
 *  - `EXCEDIDA`      (rojo):  sentada y pasada su duración de mesa.
 */
export type FaseTiempoReserva =
  | "CUENTA_ATRAS"
  | "RETRASO"
  | "OCUPACION"
  | "EXCEDIDA";

export interface TiempoReserva {
  fase: FaseTiempoReserva;
  /** "HH:MM" ya formateado (sin segundos, como pidió sala). */
  texto: string;
  /** Minutos que pasan de la duración prevista. Solo > 0 en EXCEDIDA. */
  minutosExceso: number;
  /** Frase para el tooltip de la fila. */
  detalle: string;
}

/**
 * Antelación con la que aparece la cuenta atrás. Antes de esto la columna va
 * vacía: una reserva de las 21:00 no dice nada a las 11:00 de la mañana.
 */
export const TIEMPO_ANTELACION_MINUTOS = 3 * 60;

/**
 * Tope del contador cuando ya va en rojo (retraso o mesa excedida).
 *
 * Seis horas: es lo máximo que una reserva puede estar de verdad en la mesa.
 * A partir de ahí el número no cuenta nada real —nadie come seis horas ni
 * llega con seis horas de retraso—, solo dice que nadie cerró esa reserva.
 *
 * Sin tope no paraba NUNCA: una reserva de 2023 a la que nadie tocó el estado
 * seguía contando, y en pantalla salían más de 30.000 horas.
 *
 * Al llegar al tope el contador se queda fijo y se marca con "+" delante, para
 * que se vea que es un techo y no la cifra exacta.
 */
export const TIEMPO_TOPE_ROJO_MINUTOS = 6 * 60;

/**
 * Estados en los que el cliente YA ESTÁ EN LA MESA: a partir de aquí el
 * contador deja de contar retraso y pasa a contar ocupación.
 *
 * SENTADA es el estado propio de "está comiendo"; TERMINANDO es el tramo final
 * de esa misma ocupación (sigue en la mesa, pero ya acabando), así que también
 * cuenta. WALK_IN NO entra: eso es el ORIGEN de la reserva (cliente que llegó
 * sin reservar), no dice nada de si se ha sentado ya.
 */
const ESTADOS_SENTADA: EstadoReserva[] = ["SENTADA", "TERMINANDO"];

/**
 * Estados en los que el contador no tiene nada que decir: la reserva no va a
 * ocupar la mesa (cancelada, no-show) o ya la soltó (liberada).
 */
const ESTADOS_SIN_CONTADOR: EstadoReserva[] = ["CANCELADA", "NO_SHOW", "LIBERADA"];

/** "HH:MM" a partir de un número de minutos (siempre en positivo). */
function formatearHHMM(minutos: number): string {
  const t = Math.max(0, Math.floor(minutos));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Frase natural para el tooltip: "2 h 30 min", "45 min". */
export function formatearDuracionNatural(minutos: number): string {
  const t = Math.max(0, Math.floor(minutos));
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Duración de mesa que aplica a una reserva: la suya si la tiene, y si no la
 * que la empresa tenga por defecto.
 */
export function duracionEfectivaReserva(
  reserva: Pick<Reserva, "duracionMinutos">,
  duracionEmpresaMin: number | null | undefined,
): number {
  const propia = reserva.duracionMinutos;
  if (typeof propia === "number" && propia > 0) return propia;
  if (typeof duracionEmpresaMin === "number" && duracionEmpresaMin > 0) {
    return duracionEmpresaMin;
  }
  return DURACION_RESERVA_DEFAULT_MINUTOS;
}

/**
 * Minutos entre "ahora" y la hora de la reserva. Positivo = aún no ha llegado
 * su hora; negativo = ya pasó.
 *
 * `ahora` llega como {fecha, minutos} en la ZONA DE LA EMPRESA (`ahoraEnZona`),
 * no como Date del navegador: el ordenador de sala puede estar en otra zona y
 * la reserva es siempre la hora del restaurante.
 */
export function minutosHastaReserva(
  reserva: Pick<Reserva, "fecha" | "hora">,
  ahora: { fecha: string; minutos: number },
): number | null {
  const [hh, mm] = (reserva.hora ?? "").slice(0, 5).split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const diaReserva = Date.parse(`${reserva.fecha}T00:00:00Z`);
  const diaAhora = Date.parse(`${ahora.fecha}T00:00:00Z`);
  if (Number.isNaN(diaReserva) || Number.isNaN(diaAhora)) return null;

  const diasDeDiferencia = Math.round((diaReserva - diaAhora) / 86_400_000);
  return diasDeDiferencia * 1440 + (hh * 60 + mm) - ahora.minutos;
}

/**
 * Estado del contador de una reserva, o `null` si no toca enseñar nada
 * (falta más de la antelación, la reserva está anulada, o la hora no es válida).
 */
export function calcularTiempoReserva(
  reserva: Pick<Reserva, "fecha" | "hora" | "estado" | "duracionMinutos">,
  ahora: { fecha: string; minutos: number },
  duracionEmpresaMin: number | null | undefined,
): TiempoReserva | null {
  if (ESTADOS_SIN_CONTADOR.includes(reserva.estado)) return null;

  const restantes = minutosHastaReserva(reserva, ahora);
  if (restantes == null) return null;

  const duracion = duracionEfectivaReserva(reserva, duracionEmpresaMin);
  const sentada = ESTADOS_SENTADA.includes(reserva.estado);

  // Sentada: cuenta la ocupación desde la HORA DE LA RESERVA. Si el cliente
  // llegó a las 21:10 de una reserva de las 21:00, la mesa lleva 00:10.
  if (sentada) {
    const ocupados = Math.max(0, -restantes);
    if (ocupados >= duracion) {
      const exceso = ocupados - duracion;
      const topado = exceso > TIEMPO_TOPE_ROJO_MINUTOS;
      return {
        fase: "EXCEDIDA",
        texto: topado
          ? `+${formatearHHMM(duracion + TIEMPO_TOPE_ROJO_MINUTOS)}`
          : formatearHHMM(ocupados),
        minutosExceso: exceso,
        detalle:
          exceso === 0
            ? `La mesa ha cumplido su tiempo previsto (${formatearDuracionNatural(duracion)}).`
            : topado
              ? `Lleva ${formatearDuracionNatural(exceso)} de exceso sobre el tiempo previsto (${formatearDuracionNatural(duracion)}). El contador se para a las ${formatearDuracionNatural(TIEMPO_TOPE_ROJO_MINUTOS)}: seguramente nadie cerró esta reserva.`
              : `Lleva ${formatearDuracionNatural(exceso)} de exceso sobre el tiempo previsto (${formatearDuracionNatural(duracion)}).`,
      };
    }
    return {
      fase: "OCUPACION",
      texto: formatearHHMM(ocupados),
      minutosExceso: 0,
      detalle: `Mesa ocupada desde la hora de la reserva. Tiempo previsto: ${formatearDuracionNatural(duracion)}.`,
    };
  }

  // Aún no ha llegado su hora: cuenta atrás desde 3 h antes.
  if (restantes > 0) {
    if (restantes > TIEMPO_ANTELACION_MINUTOS) return null;
    return {
      fase: "CUENTA_ATRAS",
      texto: formatearHHMM(restantes),
      minutosExceso: 0,
      detalle: `Faltan ${formatearDuracionNatural(restantes)} para la reserva.`,
    };
  }

  // Pasó la hora y el cliente no se ha sentado: retraso.
  const retraso = -restantes;
  const retrasoTopado = retraso > TIEMPO_TOPE_ROJO_MINUTOS;
  return {
    fase: "RETRASO",
    texto: retrasoTopado
      ? `+${formatearHHMM(TIEMPO_TOPE_ROJO_MINUTOS)}`
      : formatearHHMM(retraso),
    minutosExceso: 0,
    detalle:
      retraso === 0
        ? "Es la hora de la reserva y el cliente aún no ha llegado."
        : retrasoTopado
          ? `Pasaron ${formatearDuracionNatural(retraso)} de su hora. El contador se para a las ${formatearDuracionNatural(TIEMPO_TOPE_ROJO_MINUTOS)}: seguramente nadie cerró esta reserva.`
          : `El cliente lleva ${formatearDuracionNatural(retraso)} de retraso.`,
  };
}

/** Color del contador según la fase. Verde, rojo o azul, como pidió sala. */
export const TIEMPO_FASE_CLASS: Record<FaseTiempoReserva, string> = {
  CUENTA_ATRAS: "text-emerald-600 [.sala-oscuro_&]:text-emerald-400",
  RETRASO: "text-red-600 [.sala-oscuro_&]:text-red-400",
  OCUPACION: "text-sky-600 [.sala-oscuro_&]:text-sky-400",
  EXCEDIDA: "text-red-600 [.sala-oscuro_&]:text-red-400",
};
