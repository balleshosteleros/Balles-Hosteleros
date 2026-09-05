import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DURACION_RESERVA_DEFAULT_MINUTOS,
  ESTADO_ORDEN_PRIORIDAD,
  ESTADOS_NO_OCUPANTES,
  type EstadoReserva,
} from "@/features/sala/data/reservas";

// Reexport para no romper imports históricos (motor-web-validar, asignacion-mesa).
export { ESTADOS_NO_OCUPANTES };

/**
 * Devuelve la duración por reserva configurada para la empresa en minutos.
 * Si la fila o el valor no están, devuelve el default global (120 min).
 */
export async function getDuracionReservaMin(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<number> {
  const { data } = await supabase
    .from("empresa_reservas_config")
    .select("duracion_reserva_min")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const n = (data?.duracion_reserva_min as number | null) ?? null;
  return typeof n === "number" && n > 0 ? n : DURACION_RESERVA_DEFAULT_MINUTOS;
}

function partesHora(hora: string): { h: number; m: number } {
  const [h, m] = hora.split(":").map((n) => parseInt(n, 10));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

function horaAStr(h: number, m: number): string {
  // Normaliza al reloj de 24h: una franja que termina a las 25:30 (01:30 de la
  // madrugada siguiente) se muestra como "01:30". La pertenencia a la jornada
  // la lleva `horaAMinutosJornada`, no el texto.
  const total = ((h * 60 + m) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

/**
 * Convierte una hora (HH:MM[:SS]) a minutos desde 00:00.
 */
export function horaAMinutos(hora: string): number {
  const { h, m } = partesHora(hora);
  return h * 60 + m;
}

/**
 * Hora a partir de la cual una hora "pequeña" se considera madrugada de la
 * noche ANTERIOR y no primera hora de la mañana.
 *
 * Un restaurante no sirve cenas a las 04:00 ni desayunos a las 05:00: por
 * debajo de este corte, la hora pertenece siempre a la jornada que empezó el
 * día antes. Por encima, es la mañana del propio día.
 */
export const CORTE_MADRUGADA_MINUTOS = 6 * 60; // 06:00

/**
 * Minutos de una hora dentro de la JORNADA del restaurante, no dentro del reloj.
 *
 * Una jornada de sala no termina a medianoche: la cena de las 23:30 con dos
 * horas de duración acaba a la 01:30, y esa 01:30 sigue siendo "la misma
 * noche". Si se midiera desde 00:00 del reloj, la reserva de la 01:30 daría
 * 90 minutos y parecería ANTERIOR a la cena que la está pisando, con lo que el
 * solape no se detectaba y se podía doblar la mesa de madrugada.
 *
 * Aquí las horas por debajo de `CORTE_MADRUGADA_MINUTOS` se desplazan un día
 * (01:30 → 1530 min = 25:30), de modo que toda la noche queda en una recta
 * continua y comparable con simple aritmética.
 */
export function horaAMinutosJornada(hora: string): number {
  const min = horaAMinutos(hora);
  return min < CORTE_MADRUGADA_MINUTOS ? min + 24 * 60 : min;
}

/**
 * Orden en que las reservas LLEGAN a la sala, de la primera a la última.
 *
 * El criterio es la JORNADA, no el reloj: el listado ordenaba con
 * `hora.localeCompare(hora)`, así que "00:30" era menor que "20:00" y la
 * madrugada —que es el final de la noche— salía en lo alto de la lista, por
 * delante de las cenas que la habían precedido. Con `horaAMinutosJornada` esa
 * 00:30 vale 24:30 y cae donde de verdad ocurre: detrás de las 23:45.
 *
 * A igualdad de hora manda `ESTADO_ORDEN_PRIORIDAD` (lo vivo antes que lo
 * cancelado) y, si también empatan, el código de mesa en orden natural, para
 * que la lista no baile de un refresco a otro: sin este último desempate dos
 * reservas idénticas en hora y estado quedaban en el orden en que llegaran de
 * la consulta, que no está garantizado.
 */
export function compararReservasPorJornada(
  a: { hora: string; estado: EstadoReserva; mesaCodigo?: string | null },
  b: { hora: string; estado: EstadoReserva; mesaCodigo?: string | null },
): number {
  const horaCmp = horaAMinutosJornada(a.hora) - horaAMinutosJornada(b.hora);
  if (horaCmp !== 0) return horaCmp;
  const estadoCmp =
    ESTADO_ORDEN_PRIORIDAD[a.estado] - ESTADO_ORDEN_PRIORIDAD[b.estado];
  if (estadoCmp !== 0) return estadoCmp;
  return (a.mesaCodigo ?? "").localeCompare(b.mesaCodigo ?? "", undefined, {
    numeric: true,
  });
}

/**
 * ¿Se solapan dos franjas de la misma jornada?
 *
 * Ambas se sitúan en la recta continua de la noche (ver
 * `horaAMinutosJornada`), así que una cena de 23:30 y otra de 00:30 se
 * comparan correctamente aunque el reloj haya dado la vuelta.
 *
 * El final es EXCLUSIVO: una reserva que termina a las 23:00 no choca con otra
 * que empieza a las 23:00 — la mesa queda libre justo al terminar.
 */
export function franjasSolapan(
  horaA: string,
  duracionA: number,
  horaB: string,
  duracionB: number,
): boolean {
  const iniA = horaAMinutosJornada(horaA);
  const finA = iniA + Math.max(1, duracionA);
  const iniB = horaAMinutosJornada(horaB);
  const finB = iniB + Math.max(1, duracionB);
  return iniB < finA && iniA < finB;
}

/**
 * Calcula la ventana [desde, hasta) durante la cual una mesa queda ocupada
 * por una reserva en `hora` que dura `duracionMin` minutos.
 */
export function ventanaOcupacion(
  hora: string,
  duracionMin: number,
): { desde: string; hasta: string } {
  const inicioMin = horaAMinutos(hora);
  const finMin = inicioMin + Math.max(1, duracionMin);
  const desdeH = Math.floor(inicioMin / 60);
  const desdeM = inicioMin % 60;
  const hastaH = Math.floor(finMin / 60);
  const hastaM = finMin % 60;
  return {
    desde: horaAStr(desdeH, desdeM),
    hasta: horaAStr(hastaH, hastaM),
  };
}

/**
 * Comprueba si una mesa concreta tiene ya una reserva viva que solapa con la
 * franja [hora, hora + duracion). Si la encuentra, devuelve la primera para
 * que la UI pueda explicar el motivo. `ignoreReservaId` permite excluir la
 * propia reserva al editarla.
 */
export async function buscarConflictoMesa(
  supabase: SupabaseClient,
  args: {
    empresaId: string;
    fecha: string;
    hora: string;
    mesa: string;
    duracionMin: number;
    ignoreReservaId?: string | null;
    /**
     * Local de la mesa. `reservas` solo guarda el CÓDIGO ("R1") como texto, y
     * ese código se repite entre locales de la misma empresa, así que sin esto
     * una reserva del "R1" de otro local bloqueaba el "R1" de este.
     */
    localId?: string | null;
  },
): Promise<{ hora: string; clienteNombre: string | null } | null> {
  // Una reserva sobre una unión se graba como "M1+M2", así que comparar la
  // cadena entera dejaba pasar una reserva suelta en M1 sobre la unión M1+M2
  // (doble ocupación física de la misma mesa). Trabajamos con el CONJUNTO de
  // mesas físicas implicadas y buscamos intersección.
  const mesasPedidas = new Set(
    args.mesa.split("+").map((m) => m.trim().toUpperCase()).filter(Boolean),
  );
  if (mesasPedidas.size === 0) return null;

  // Traemos las reservas vivas del día (sin filtrar por mesa en SQL: hay que
  // inspeccionar los códigos compuestos) y resolvemos el solape en JS.
  let query = supabase
    .from("reservas")
    .select("id, hora, cliente_nombre, estado, mesa, duracion_minutos")
    .eq("empresa_id", args.empresaId)
    .eq("fecha", args.fecha)
    .not("mesa", "is", null)
    .not("estado", "in", `(${ESTADOS_NO_OCUPANTES.join(",")})`);
  if (args.ignoreReservaId) query = query.neq("id", args.ignoreReservaId);
  const { data, error } = await query;
  if (error) {
    // Fail-CLOSED: si no podemos comprobar el solape, no confirmamos la reserva.
    // Devolver "sin conflicto" ante un fallo de BD permitía dobles reservas.
    console.error("[reserva-conflicto] error:", error);
    throw error;
  }

  // Códigos que de verdad existen en este local: descarta las mesas homónimas
  // de otros locales, que no ocupan nada aquí.
  let codigosLocal: Set<string> | null = null;
  if (args.localId) {
    const { data: mesasRows } = await supabase
      .from("mesas")
      .select("codigo")
      .eq("local_id", args.localId);
    codigosLocal = new Set(
      (mesasRows ?? [])
        .map((m) => ((m.codigo as string | null) ?? "").trim().toUpperCase())
        .filter(Boolean),
    );
  }

  for (const r of data ?? []) {
    const mesaOtra = (r.mesa as string | null) ?? "";
    const mesasOtra = mesaOtra
      .split("+")
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean)
      .filter((m) => !codigosLocal || codigosLocal.has(m));
    if (!mesasOtra.some((m) => mesasPedidas.has(m))) continue;

    const otraHora = (r.hora as string) ?? "";
    // Cada reserva dura LO SUYO: si la existente tiene override (p.ej. una cena
    // de empresa de 300 min), usarlo. Antes se aplicaba la duración de la
    // reserva entrante a la existente, y una reserva larga dejaba de proteger
    // su propia franja.
    const duracionOtra = Number(r.duracion_minutos);
    const duracionAplicada =
      Number.isFinite(duracionOtra) && duracionOtra > 0 ? duracionOtra : args.duracionMin;
    // Comparación en minutos de JORNADA: una cena de 23:30 y otra de 00:30 son
    // la misma noche, así que el cruce de medianoche también cuenta como solape.
    if (franjasSolapan(args.hora, args.duracionMin, otraHora, duracionAplicada)) {
      return {
        hora: otraHora.slice(0, 5),
        clienteNombre: (r.cliente_nombre as string | null) ?? null,
      };
    }
  }
  return null;
}
