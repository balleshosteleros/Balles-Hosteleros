// Motor de horario por fecha (server-side). Resuelve los tramos previstos de un
// empleado en una fecha concreta combinando:
//   • asignación directa de turno  (rrhh_turno_empleados.vigente_desde <= fecha)
//   • patrones semanales           (rrhh_patron_empleados → rrhh_patrones →
//                                    rrhh_patron_semanas.dias[díaSemana] → turno)
//
// Política conservadora de rotación: como los patrones no están anclados a una
// fecha de inicio, si el empleado trabaja ese día de la semana en CUALQUIER
// semana del patrón se considera que tiene horario ese día (se prefiere permitir
// a bloquear de más). El cruce de medianoche se resuelve en quien consume los
// tramos, no aquí.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Tramo = { inicio: string; fin: string };

/** Minutos del día (0–1439) a partir de "HH:MM". null si no es válido. */
export function hhmmAMinutos(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** Minutos del día a "HH:MM" (admite valores ≥1440 → módulo 24h). */
export function minutosAHHMM(min: number): string {
  const n = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Índice de día con lunes = 0 … domingo = 6, desde una fecha "YYYY-MM-DD". */
function indexLunes(fechaISO: string): number {
  // Mediodía local para evitar saltos por DST/zona.
  const d = new Date(`${fechaISO}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

/** "Ahora" en Europe/Madrid: fecha YYYY-MM-DD y minutos del día (0–1439). */
export function ahoraEnMadrid(): { fecha: string; minutos: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const fecha = `${get("year")}-${get("month")}-${get("day")}`;
  const minutos = Number(get("hour")) * 60 + Number(get("minute"));
  return { fecha, minutos };
}

/** Letras de día con lunes = 0 … domingo = 6 (igual que DIAS_SEMANA). */
const LETRAS_DIA = ["L", "M", "X", "J", "V", "S", "D"] as const;

type TurnoAplicable = {
  id: string;
  tramos: Tramo[];
  tipoJornada: "fijo" | "flexible";
  flexHoras: Record<string, number>;
  flexModo: "diario" | "semanal";
  dias: string[];
};

/**
 * Turnos que aplican a un empleado en una fecha, combinando planificación
 * concreta, asignación directa y patrones. La planificación y los patrones son
 * explícitos para ESE día; la asignación directa aplica siempre si es fija, y
 * si es flexible solo en los días marcados en el turno (turno.dias).
 */
async function turnosAplicablesDia(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoId: string,
  fechaISO: string,
): Promise<TurnoAplicable[]> {
  const weekday = indexLunes(fechaISO);
  const letra = LETRAS_DIA[weekday];
  const idsExplicitos = new Set<string>(); // planificación + patrón (ya son del día)
  const idsDirectos = new Set<string>();   // directos (se filtran por turno.dias si flexible)

  // 0) Planificación concreta (la "libreta"): manda y es del día.
  const { data: planif } = await supabase
    .from("rrhh_planificacion")
    .select("turno_id")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .eq("fecha", fechaISO);
  for (const p of planif ?? []) {
    const tid = (p as { turno_id?: string | null }).turno_id;
    if (tid) idsExplicitos.add(tid);
  }

  // a) Asignación directa (turno suelto / por defecto)
  const { data: directos } = await supabase
    .from("rrhh_turno_empleados")
    .select("turno_id, vigente_desde")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .lte("vigente_desde", fechaISO);
  for (const d of directos ?? []) {
    const tid = (d as { turno_id?: string | null }).turno_id;
    if (tid) idsDirectos.add(tid);
  }

  // b) Patrones semanales vigentes: la celda del día de la semana.
  const { data: pe } = await supabase
    .from("rrhh_patron_empleados")
    .select("patron_id, vigente_desde")
    .eq("empleado_id", empleadoId)
    .lte("vigente_desde", fechaISO);
  const patronIds = (pe ?? [])
    .map((r) => (r as { patron_id?: string | null }).patron_id)
    .filter((x): x is string => Boolean(x));

  if (patronIds.length > 0) {
    const { data: patrones } = await supabase
      .from("rrhh_patrones")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", patronIds)
      .lte("vigente_desde", fechaISO)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${fechaISO}`);
    const activos = (patrones ?? []).map((p) => (p as { id: string }).id);
    if (activos.length > 0) {
      const { data: semanas } = await supabase
        .from("rrhh_patron_semanas")
        .select("patron_id, dias")
        .in("patron_id", activos);
      for (const s of semanas ?? []) {
        const dias = ((s as { dias?: (string | null)[] }).dias ?? []) as (string | null)[];
        const tid = dias[weekday];
        if (tid) idsExplicitos.add(tid);
      }
    }
  }

  const todosIds = new Set<string>([...idsExplicitos, ...idsDirectos]);
  if (todosIds.size === 0) return [];

  const { data: turnos } = await supabase
    .from("rrhh_turnos")
    .select("id, tramos, activo, tipo_jornada, flex_horas, flex_modo, dias")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .in("id", Array.from(todosIds));

  const out: TurnoAplicable[] = [];
  for (const t of turnos ?? []) {
    const row = t as {
      id: string;
      tramos?: { inicio?: string; fin?: string }[];
      tipo_jornada?: string;
      flex_horas?: Record<string, number> | null;
      flex_modo?: string | null;
      dias?: string[] | null;
    };
    const tipoJornada = (row.tipo_jornada as "fijo" | "flexible") ?? "fijo";
    const dias = (row.dias as string[] | null) ?? [];

    // Aplicabilidad: explícito (planif/patrón) cuenta siempre; directo cuenta si
    // es fijo, o si es flexible y hoy es uno de sus días marcados.
    const esExplicito = idsExplicitos.has(row.id);
    const esDirecto = idsDirectos.has(row.id);
    const aplica =
      esExplicito ||
      (esDirecto && (tipoJornada !== "flexible" || dias.includes(letra)));
    if (!aplica) continue;

    const tramos: Tramo[] = [];
    for (const tr of row.tramos ?? []) {
      if (tr?.inicio && tr?.fin) tramos.push({ inicio: tr.inicio, fin: tr.fin });
    }
    out.push({
      id: row.id,
      tramos,
      tipoJornada,
      flexHoras: (row.flex_horas as Record<string, number> | null) ?? {},
      flexModo: (row.flex_modo as "diario" | "semanal") ?? "diario",
      dias,
    });
  }
  return out;
}

export type HorarioDia =
  | { tipo: "ninguno" }
  | { tipo: "fijo"; tramos: Tramo[] }
  | {
      tipo: "flexible";
      modo: "diario" | "semanal";
      /** Objetivo de horas del periodo (día si 'diario', semana si 'semanal'). */
      objetivoHoras: number;
      tramos: Tramo[];
    };

/**
 * Horario del empleado en la fecha: 'ninguno' (no puede fichar), 'fijo' (con
 * tramos y ventana de hora) o 'flexible' (sin ventana; con objetivo de horas y
 * su ámbito diario/semanal para el autocierre del fichaje). Si concurren turnos
 * fijos y flexibles el mismo día, mandan los fijos (tienen ventana horaria).
 */
export async function getHorarioDia(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoId: string,
  fechaISO: string,
): Promise<HorarioDia> {
  const turnos = await turnosAplicablesDia(supabase, empresaId, empleadoId, fechaISO);
  const tramos = turnos
    .filter((t) => t.tipoJornada !== "flexible")
    .flatMap((t) => t.tramos);
  if (tramos.length > 0) return { tipo: "fijo", tramos };

  const flex = turnos.find((t) => t.tipoJornada === "flexible");
  if (flex) {
    const letra = LETRAS_DIA[indexLunes(fechaISO)];
    const objetivoHoras =
      flex.flexModo === "semanal"
        ? Object.values(flex.flexHoras).reduce((a, b) => a + (Number(b) || 0), 0)
        : Number(flex.flexHoras[letra] ?? 0);
    return { tipo: "flexible", modo: flex.flexModo, objetivoHoras, tramos: [] };
  }
  return { tipo: "ninguno" };
}

/**
 * Tramos previstos del empleado en la fecha dada. Devuelve [] si el empleado
 * NO tiene horario fijo ese día (los flexibles no tienen tramos). Se mantiene
 * para los consumidores que solo necesitan la ventana horaria.
 */
export async function getTramosHorarioEmpleado(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoId: string,
  fechaISO: string,
): Promise<Tramo[]> {
  const turnos = await turnosAplicablesDia(supabase, empresaId, empleadoId, fechaISO);
  return turnos.flatMap((t) => t.tramos);
}

/** Lunes y domingo (YYYY-MM-DD) de la semana ISO que contiene la fecha. */
export function semanaDeFecha(fechaISO: string): { lunes: string; domingo: string } {
  const d = new Date(`${fechaISO}T12:00:00`);
  const weekday = (d.getDay() + 6) % 7; // lunes = 0
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - weekday);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return {
    lunes: lunes.toISOString().slice(0, 10),
    domingo: domingo.toISOString().slice(0, 10),
  };
}

/**
 * ¿Está `minutosAhora` (minutos del día en Madrid) dentro de alguno de los
 * tramos, aplicando margen antes/después y resolviendo cruce de medianoche?
 */
export function dentroDeMargen(
  tramos: Tramo[],
  minutosAhora: number,
  margenAntesMin: number,
  margenDespuesMin: number,
): boolean {
  for (const tr of tramos) {
    const rawIni = hhmmAMinutos(tr.inicio);
    const rawFin = hhmmAMinutos(tr.fin);
    if (rawIni == null || rawFin == null) continue;
    const cruzaMedianoche = rawFin <= rawIni;
    const ini = rawIni - margenAntesMin;
    const fin = (cruzaMedianoche ? rawFin + 1440 : rawFin) + margenDespuesMin;
    if (
      (minutosAhora >= ini && minutosAhora <= fin) ||
      (minutosAhora + 1440 >= ini && minutosAhora + 1440 <= fin)
    ) {
      return true;
    }
  }
  return false;
}

/** Texto legible de los tramos con margen aplicado, para mensajes de error. */
export function describirVentanas(
  tramos: Tramo[],
  margenAntesMin: number,
  margenDespuesMin: number,
): string {
  return tramos
    .map((tr) => {
      const rawIni = hhmmAMinutos(tr.inicio) ?? 0;
      const rawFin = hhmmAMinutos(tr.fin) ?? 0;
      return `${minutosAHHMM(rawIni - margenAntesMin)}–${minutosAHHMM(rawFin + margenDespuesMin)}`;
    })
    .join(", ");
}
