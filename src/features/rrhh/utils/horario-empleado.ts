// Motor de horario por fecha (server-side). Resuelve los tramos previstos de un
// empleado en una fecha concreta combinando:
//   • asignación directa de turno  (rrhh_turno_empleados.vigente_desde <= fecha)
//   • patrones semanales           (rrhh_patron_empleados → rrhh_patrones →
//                                    rrhh_patron_semanas.dias[díaSemana] → turno)
//
// Patrones ROTATIVOS: un patrón puede tener varias semanas que se van
// alternando (semana 1, semana 2, vuelta a la 1…). La que toca se calcula
// contando las semanas transcurridas desde `vigente_desde` del patrón. Con una
// sola semana, todas las semanas son esa. El cruce de medianoche se resuelve en
// quien consume los tramos, no aquí.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";

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

/** Lunes de la semana de una fecha, a mediodía (inmune a DST). */
function lunesDe(fechaISO: string): Date {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * Cuál de las semanas del patrón rige en `fechaISO`, contando desde el arranque
 * del patrón y rotando.
 *
 * Un patrón de 2 semanas alterna: la primera semana rige la semana 1, la
 * siguiente la semana 2, la siguiente vuelve a la 1. Con UNA sola semana,
 * todas las semanas son esa.
 *
 * Se cuenta en semanas COMPLETAS entre el lunes del arranque y el lunes de la
 * fecha, para que la rotación cambie el lunes y no a mitad de semana.
 *
 * Antes no se elegía ninguna: se miraban TODAS las semanas a la vez y bastaba
 * que se trabajara ese día en cualquiera de ellas. Con eso, un patrón rotativo
 * marcaba como laborables días que el empleado libraba — RRHH decía "libra" y
 * su app decía "trabaja".
 */
function semanaQueRige(
  fechaISO: string,
  vigenteDesde: string | null,
  totalSemanas: number,
): number {
  if (totalSemanas <= 1) return 0;
  if (!vigenteDesde) return 0;
  const inicio = lunesDe(vigenteDesde).getTime();
  const actual = lunesDe(fechaISO).getTime();
  const semanas = Math.floor((actual - inicio) / 604800000); // 7 días en ms
  return ((semanas % totalSemanas) + totalSemanas) % totalSemanas;
}

/**
 * "Ahora" en Europe/Madrid: fecha YYYY-MM-DD y minutos del día (0–1439).
 *
 * @deprecated Usa `ahoraEnZona(tz)` de `@/features/empresa/lib/zona-horaria` con
 * la zona horaria de la empresa (`getZonaHorariaEmpresa`). Esto queda como atajo
 * para España mientras se completa la migración (PRP-069).
 */
export function ahoraEnMadrid(): { fecha: string; minutos: number } {
  return ahoraEnZona("Europe/Madrid");
}

/** Letras de día con lunes = 0 … domingo = 6 (igual que DIAS_SEMANA). */
const LETRAS_DIA = ["L", "M", "X", "J", "V", "S", "D"] as const;

type TurnoAplicable = {
  id: string;
  tramos: Tramo[];
  tipoJornada: "fijo" | "flexible";
  flexHoras: Record<string, number>;
  /** Horas/día del flexible (modelo nuevo, sin días). null = legacy. */
  flexHorasDia: number | null;
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

  // a) Asignación directa (turno suelto / por defecto). La asignación debe estar
  //    vigente ese día: ya empezó (vigente_desde ≤ fecha) y no ha terminado
  //    (vigente_hasta NULL = ilimitado, o ≥ fecha).
  const { data: directos } = await supabase
    .from("rrhh_turno_empleados")
    .select("turno_id, vigente_desde")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .lte("vigente_desde", fechaISO)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${fechaISO}`);
  for (const d of directos ?? []) {
    const tid = (d as { turno_id?: string | null }).turno_id;
    if (tid) idsDirectos.add(tid);
  }

  // b) Patrones semanales vigentes: la celda del día de la semana. La ASIGNACIÓN
  //    del patrón al empleado debe estar vigente ese día (empezó y no terminó).
  const { data: pe } = await supabase
    .from("rrhh_patron_empleados")
    .select("patron_id, vigente_desde")
    .eq("empleado_id", empleadoId)
    .lte("vigente_desde", fechaISO)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${fechaISO}`);
  const patronIds = (pe ?? [])
    .map((r) => (r as { patron_id?: string | null }).patron_id)
    .filter((x): x is string => Boolean(x));

  if (patronIds.length > 0) {
    const { data: patrones } = await supabase
      .from("rrhh_patrones")
      .select("id, vigente_desde")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", patronIds)
      .lte("vigente_desde", fechaISO)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${fechaISO}`);
    const activos = (patrones ?? []) as { id: string; vigente_desde: string | null }[];
    if (activos.length > 0) {
      const { data: semanas } = await supabase
        .from("rrhh_patron_semanas")
        .select("patron_id, orden, dias")
        .in(
          "patron_id",
          activos.map((p) => p.id),
        )
        .order("orden", { ascending: true });

      // Semanas de cada patrón, en su orden de rotación.
      const porPatron = new Map<string, (string | null)[][]>();
      for (const s of semanas ?? []) {
        const row = s as { patron_id: string; dias?: (string | null)[] };
        const lista = porPatron.get(row.patron_id) ?? [];
        lista.push((row.dias ?? []) as (string | null)[]);
        porPatron.set(row.patron_id, lista);
      }

      // De cada patrón se aplica SOLO la semana que rige hoy, no todas.
      for (const patron of activos) {
        const lista = porPatron.get(patron.id);
        if (!lista || lista.length === 0) continue;
        const idx = semanaQueRige(fechaISO, patron.vigente_desde, lista.length);
        const tid = lista[idx]?.[weekday];
        if (tid) idsExplicitos.add(tid);
      }
    }
  }

  const todosIds = new Set<string>([...idsExplicitos, ...idsDirectos]);
  if (todosIds.size === 0) return [];

  const { data: turnos } = await supabase
    .from("rrhh_turnos")
    .select("id, tramos, activo, tipo_jornada, flex_horas, flex_horas_dia, flex_modo, dias")
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
      flex_horas_dia?: number | string | null;
      flex_modo?: string | null;
      dias?: string[] | null;
    };
    const tipoJornada = (row.tipo_jornada as "fijo" | "flexible") ?? "fijo";
    const dias = (row.dias as string[] | null) ?? [];

    // Aplicabilidad: explícito (planif/patrón) cuenta siempre; directo cuenta si
    // es fijo, o si es flexible y hoy es uno de sus días marcados. En el modelo
    // nuevo el flexible no tiene días (dias=[]) → aplica cualquier día asignado
    // directamente (el día concreto se decide por patrón o planificación).
    const esExplicito = idsExplicitos.has(row.id);
    const esDirecto = idsDirectos.has(row.id);
    const aplica =
      esExplicito ||
      (esDirecto &&
        (tipoJornada !== "flexible" ||
          dias.length === 0 ||
          dias.includes(letra)));
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
      flexHorasDia:
        row.flex_horas_dia == null ? null : Number(row.flex_horas_dia),
      flexModo: (row.flex_modo as "diario" | "semanal") ?? "diario",
      dias,
    });
  }
  return out;
}

/**
 * Igual que `getHorarioDia`, pero para MUCHOS empleados a la vez y un solo día.
 *
 * `getHorarioDia` hace 5 consultas por empleado. Llamarla dentro de un bucle
 * (el cron de reavisos lo hacía cada minuto, empleado a empleado) dispara
 * 5 × nº de empleados consultas por vuelta: eso saturaba la base de datos y
 * dejaba sin respuesta al resto del software. Aquí se hacen esas mismas 5
 * consultas UNA vez, pidiendo los datos de todos los empleados de golpe, y
 * después se reparte en memoria.
 *
 * Devuelve un mapa empleadoId → horario. Los empleados sin turno ese día salen
 * con `{ tipo: "ninguno" }`.
 */
export async function getHorarioDiaLote(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoIds: string[],
  fechaISO: string,
): Promise<Map<string, HorarioDia>> {
  const salida = new Map<string, HorarioDia>();
  for (const id of empleadoIds) salida.set(id, { tipo: "ninguno" });
  if (empleadoIds.length === 0) return salida;

  const weekday = indexLunes(fechaISO);
  const letra = LETRAS_DIA[weekday];
  // Por empleado: ids de turno que le aplican hoy, separados igual que en
  // `turnosAplicablesDia` (explícitos mandan; los directos se filtran por día).
  const explicitosPorEmpleado = new Map<string, Set<string>>();
  const directosPorEmpleado = new Map<string, Set<string>>();
  const anotar = (mapa: Map<string, Set<string>>, empId: string, turnoId: string) => {
    let set = mapa.get(empId);
    if (!set) { set = new Set(); mapa.set(empId, set); }
    set.add(turnoId);
  };

  // Las tres fuentes de turno, cada una en UNA consulta para todos.
  const [planifRes, directosRes, peRes] = await Promise.all([
    supabase
      .from("rrhh_planificacion")
      .select("empleado_id, turno_id")
      .eq("empresa_id", empresaId)
      .eq("fecha", fechaISO)
      .in("empleado_id", empleadoIds),
    supabase
      .from("rrhh_turno_empleados")
      .select("empleado_id, turno_id")
      .eq("empresa_id", empresaId)
      .in("empleado_id", empleadoIds)
      .lte("vigente_desde", fechaISO)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${fechaISO}`),
    supabase
      .from("rrhh_patron_empleados")
      .select("empleado_id, patron_id")
      .in("empleado_id", empleadoIds)
      .lte("vigente_desde", fechaISO)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${fechaISO}`),
  ]);

  for (const r of planifRes.data ?? []) {
    const row = r as { empleado_id?: string | null; turno_id?: string | null };
    if (row.empleado_id && row.turno_id) anotar(explicitosPorEmpleado, row.empleado_id, row.turno_id);
  }
  for (const r of directosRes.data ?? []) {
    const row = r as { empleado_id?: string | null; turno_id?: string | null };
    if (row.empleado_id && row.turno_id) anotar(directosPorEmpleado, row.empleado_id, row.turno_id);
  }

  // Patrones: se resuelven en bloque y la celda del día se reparte a cada
  // empleado que tenga ese patrón asignado.
  const patronesPorEmpleado = new Map<string, string[]>();
  const todosPatronIds = new Set<string>();
  for (const r of peRes.data ?? []) {
    const row = r as { empleado_id?: string | null; patron_id?: string | null };
    if (!row.empleado_id || !row.patron_id) continue;
    const lista = patronesPorEmpleado.get(row.empleado_id) ?? [];
    lista.push(row.patron_id);
    patronesPorEmpleado.set(row.empleado_id, lista);
    todosPatronIds.add(row.patron_id);
  }

  if (todosPatronIds.size > 0) {
    const { data: patrones } = await supabase
      .from("rrhh_patrones")
      .select("id, vigente_desde")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", Array.from(todosPatronIds))
      .lte("vigente_desde", fechaISO)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${fechaISO}`);
    const activosRows = (patrones ?? []) as { id: string; vigente_desde: string | null }[];
    const activos = activosRows.map((p) => p.id);
    if (activos.length > 0) {
      const { data: semanas } = await supabase
        .from("rrhh_patron_semanas")
        .select("patron_id, orden, dias")
        .in("patron_id", activos)
        .order("orden", { ascending: true });

      // Semanas de cada patrón, en su orden de rotación.
      const semanasPorPatron = new Map<string, (string | null)[][]>();
      for (const s of semanas ?? []) {
        const row = s as { patron_id?: string | null; dias?: (string | null)[] };
        if (!row.patron_id) continue;
        const lista = semanasPorPatron.get(row.patron_id) ?? [];
        lista.push((row.dias ?? []) as (string | null)[]);
        semanasPorPatron.set(row.patron_id, lista);
      }

      // patron_id → turno de HOY, tomando SOLO la semana que rige hoy. Antes se
      // recorrían todas y se quedaba con la última, así que un patrón rotativo
      // daba el turno de una semana que no tocaba.
      const turnoDelPatron = new Map<string, string>();
      for (const patron of activosRows) {
        const lista = semanasPorPatron.get(patron.id);
        if (!lista || lista.length === 0) continue;
        const idx = semanaQueRige(fechaISO, patron.vigente_desde, lista.length);
        const tid = lista[idx]?.[weekday];
        if (tid) turnoDelPatron.set(patron.id, tid);
      }
      const activosSet = new Set(activos);
      for (const [empId, patronIds] of patronesPorEmpleado) {
        for (const pid of patronIds) {
          if (!activosSet.has(pid)) continue;
          const tid = turnoDelPatron.get(pid);
          if (tid) anotar(explicitosPorEmpleado, empId, tid);
        }
      }
    }
  }

  // Los turnos en sí: una sola consulta con todos los ids que han salido.
  const todosTurnoIds = new Set<string>();
  for (const set of explicitosPorEmpleado.values()) for (const id of set) todosTurnoIds.add(id);
  for (const set of directosPorEmpleado.values()) for (const id of set) todosTurnoIds.add(id);
  if (todosTurnoIds.size === 0) return salida;

  const { data: turnos } = await supabase
    .from("rrhh_turnos")
    .select("id, tramos, activo, tipo_jornada, flex_horas, flex_horas_dia, flex_modo, dias")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .in("id", Array.from(todosTurnoIds));

  const turnoPorId = new Map<string, TurnoAplicable>();
  for (const t of turnos ?? []) {
    const row = t as {
      id: string;
      tramos?: { inicio?: string; fin?: string }[];
      tipo_jornada?: string;
      flex_horas?: Record<string, number> | null;
      flex_horas_dia?: number | string | null;
      flex_modo?: string | null;
      dias?: string[] | null;
    };
    const tramos: Tramo[] = [];
    for (const tr of row.tramos ?? []) {
      if (tr?.inicio && tr?.fin) tramos.push({ inicio: tr.inicio, fin: tr.fin });
    }
    turnoPorId.set(row.id, {
      id: row.id,
      tramos,
      tipoJornada: (row.tipo_jornada as "fijo" | "flexible") ?? "fijo",
      flexHoras: (row.flex_horas as Record<string, number> | null) ?? {},
      flexHorasDia: row.flex_horas_dia == null ? null : Number(row.flex_horas_dia),
      flexModo: (row.flex_modo as "diario" | "semanal") ?? "diario",
      dias: (row.dias as string[] | null) ?? [],
    });
  }

  // Mismo criterio de aplicabilidad y misma preferencia fijo > flexible que
  // `turnosAplicablesDia` + `getHorarioDia`, pero ya sin tocar la base de datos.
  for (const empId of empleadoIds) {
    const explicitos = explicitosPorEmpleado.get(empId) ?? new Set<string>();
    const directos = directosPorEmpleado.get(empId) ?? new Set<string>();
    const aplicables: TurnoAplicable[] = [];
    for (const tid of new Set([...explicitos, ...directos])) {
      const turno = turnoPorId.get(tid);
      if (!turno) continue;
      const aplica =
        explicitos.has(tid) ||
        (directos.has(tid) &&
          (turno.tipoJornada !== "flexible" ||
            turno.dias.length === 0 ||
            turno.dias.includes(letra)));
      if (aplica) aplicables.push(turno);
    }

    const tramos = aplicables
      .filter((t) => t.tipoJornada !== "flexible")
      .flatMap((t) => t.tramos);
    if (tramos.length > 0) {
      salida.set(empId, { tipo: "fijo", tramos });
      continue;
    }
    const flex = aplicables.find((t) => t.tipoJornada === "flexible");
    if (flex) {
      const objetivoHoras =
        flex.flexHorasDia != null
          ? flex.flexHorasDia
          : flex.flexModo === "semanal"
            ? Object.values(flex.flexHoras).reduce((a, b) => a + (Number(b) || 0), 0)
            : Number(flex.flexHoras[letra] ?? 0);
      salida.set(empId, {
        tipo: "flexible",
        modo: flex.flexHorasDia != null ? "diario" : flex.flexModo,
        objetivoHoras,
        tramos: [],
      });
    }
  }

  return salida;
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
    // Modelo nuevo (sin días): el objetivo es flex_horas_dia, siempre diario.
    // Legacy: por día (diario) o suma de la semana (semanal).
    const objetivoHoras =
      flex.flexHorasDia != null
        ? flex.flexHorasDia
        : flex.flexModo === "semanal"
          ? Object.values(flex.flexHoras).reduce((a, b) => a + (Number(b) || 0), 0)
          : Number(flex.flexHoras[letra] ?? 0);
    const modo = flex.flexHorasDia != null ? "diario" : flex.flexModo;
    return { tipo: "flexible", modo, objetivoHoras, tramos: [] };
  }
  return { tipo: "ninguno" };
}

/**
 * Días del rango en los que el empleado TIENE horario asignado, mire o no
 * turno ese día concreto.
 *
 * `getHorarioDia` devuelve 'ninguno' en dos situaciones que no significan lo
 * mismo: el empleado libra ese día (tiene horario, pero ese día no le toca) y
 * el empleado no tiene horario puesto (nadie se lo ha asignado, o su
 * asignación ya terminó). Quien pinta un calendario necesita distinguirlas:
 * "libre" es una afirmación sobre tu jornada, "sin horario" es la ausencia del
 * dato. La diferencia está en la VIGENCIA de la asignación, no en el turno del
 * día — por eso se mira aquí y no en `getHorarioDia`.
 *
 * Devuelve el conjunto de fechas ISO cubiertas, para poder preguntar día a día.
 * Así un contrato que acaba el día 15 da "libre" hasta el 15 y "sin horario"
 * del 16 en adelante, dentro del mismo mes.
 */
export async function getDiasConHorarioAsignado(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoId: string,
  desdeISO: string,
  hastaISO: string,
): Promise<Set<string>> {
  // Intervalos [desde, hasta] de cada fuente que puede dar horario. `hasta`
  // null = sin fecha de fin (sigue vigente).
  const intervalos: { desde: string; hasta: string | null }[] = [];

  const solapa = (desde: string, hasta: string | null) =>
    desde <= hastaISO && (hasta === null || hasta >= desdeISO);

  // a) Asignación directa de turno.
  const { data: directos } = await supabase
    .from("rrhh_turno_empleados")
    .select("vigente_desde, vigente_hasta")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId);
  for (const d of directos ?? []) {
    const r = d as { vigente_desde?: string | null; vigente_hasta?: string | null };
    if (!r.vigente_desde) continue;
    const hasta = r.vigente_hasta ?? null;
    // Intervalo imposible (fin anterior al inicio): no cubre ningún día. Los
    // hay en datos reales, y darlos por buenos pintaría de "libre" un mes que
    // en realidad no tiene horario.
    if (hasta !== null && hasta < r.vigente_desde) continue;
    if (solapa(r.vigente_desde, hasta)) {
      intervalos.push({ desde: r.vigente_desde, hasta });
    }
  }

  // b) Patrón semanal: cuenta la vigencia de la asignación al empleado Y la del
  //    propio patrón (el más restrictivo de los dos manda).
  const { data: pe } = await supabase
    .from("rrhh_patron_empleados")
    .select("patron_id, vigente_desde, vigente_hasta")
    .eq("empleado_id", empleadoId);
  const asignaciones = (pe ?? []).filter((r) =>
    Boolean((r as { patron_id?: string | null }).patron_id),
  ) as { patron_id: string; vigente_desde?: string | null; vigente_hasta?: string | null }[];

  if (asignaciones.length > 0) {
    const { data: patrones } = await supabase
      .from("rrhh_patrones")
      .select("id, vigente_desde, vigente_hasta")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", asignaciones.map((a) => a.patron_id));
    const vigenciaPatron = new Map(
      (patrones ?? []).map((p) => {
        const r = p as { id: string; vigente_desde?: string | null; vigente_hasta?: string | null };
        return [r.id, { desde: r.vigente_desde ?? null, hasta: r.vigente_hasta ?? null }];
      }),
    );
    for (const a of asignaciones) {
      const patron = vigenciaPatron.get(a.patron_id);
      if (!patron) continue; // patrón inactivo o de otra empresa
      // Intersección de las dos vigencias.
      const desde = [a.vigente_desde, patron.desde].filter(Boolean).sort().pop() ?? null;
      const hastas = [a.vigente_hasta, patron.hasta].filter(Boolean).sort();
      const hasta = hastas.length > 0 ? hastas[0]! : null;
      if (!desde) continue;
      if (hasta !== null && hasta < desde) continue; // vigencias que no se tocan
      if (solapa(desde, hasta)) intervalos.push({ desde, hasta });
    }
  }

  // c) Planificación concreta: cada fecha planificada cubre ese día por sí sola.
  const { data: planif } = await supabase
    .from("rrhh_planificacion")
    .select("fecha")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", empleadoId)
    .gte("fecha", desdeISO)
    .lte("fecha", hastaISO);

  const out = new Set<string>();
  for (const p of planif ?? []) {
    const f = (p as { fecha?: string | null }).fecha;
    if (f) out.add(f);
  }

  if (intervalos.length > 0) {
    for (
      let d = new Date(desdeISO + "T00:00:00Z");
      d.toISOString().split("T")[0] <= hastaISO;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = d.toISOString().split("T")[0];
      if (intervalos.some((i) => i.desde <= key && (i.hasta === null || i.hasta >= key))) {
        out.add(key);
      }
    }
  }

  return out;
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

/** Horas decimales de una lista de tramos (resuelve cruce de medianoche). */
export function horasDeTramos(tramos: Tramo[]): number {
  let total = 0;
  for (const tr of tramos) {
    const ini = hhmmAMinutos(tr.inicio);
    let fin = hhmmAMinutos(tr.fin);
    if (ini == null || fin == null) continue;
    if (fin <= ini) fin += 1440; // cruza medianoche
    total += fin - ini;
  }
  return total / 60;
}

export type HorarioResumenEmpleado = {
  /** Nombre del/los TURNO(s) que tocan HOY (no del patrón). null = hoy descansa. */
  nombre: string | null;
  /** Etiqueta del tipo del turno de hoy: "Fijo" | "Flexible". null si descansa. */
  tipoLabel: string | null;
  /** Horas previstas hoy (decimal). null = libra hoy o flexible sin ventana. */
  horasHoy: number | null;
  /** true si el empleado tiene CUALQUIER horario asignado (aunque hoy libre). */
  tieneHorario: boolean;
};

/**
 * Resumen de horario para una LISTA de empleados en una fecha, en pocas queries
 * (batched, sin N+1). Para cada empleado devuelve el nombre/tipo del horario
 * asignado (patrón preferente, si no turno directo) y las horas previstas hoy.
 * Pensado para columnas de listados como `EmpleadosView`.
 */
export async function resolverHorarioResumen(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoIds: string[],
  hoyISO: string,
): Promise<Map<string, HorarioResumenEmpleado>> {
  const out = new Map<string, HorarioResumenEmpleado>();
  if (empleadoIds.length === 0) return out;
  const weekday = indexLunes(hoyISO);
  const letra = LETRAS_DIA[weekday];

  // Turnos que aplican HOY (ya filtrados por día): planificación + celda del
  // patrón (explícitos) y turnos directos cuyo día encaja.
  const explicitos: Record<string, Set<string>> = {};
  const directos: Record<string, Set<string>> = {};
  const addExpl = (eid: string, tid: string) => (explicitos[eid] ??= new Set<string>()).add(tid);
  const addDir = (eid: string, tid: string) => (directos[eid] ??= new Set<string>()).add(tid);
  // El empleado tiene horario asignado (vigente hoy o en el futuro) → en sus días
  // de descanso es "Libre", no "Sin horario".
  const tieneHorario: Record<string, boolean> = {};

  // 0) Planificación concreta de hoy.
  const { data: planif } = await supabase
    .from("rrhh_planificacion")
    .select("empleado_id, turno_id")
    .eq("empresa_id", empresaId)
    .in("empleado_id", empleadoIds)
    .eq("fecha", hoyISO);
  for (const p of planif ?? []) {
    const eid = (p as { empleado_id?: string }).empleado_id;
    const tid = (p as { turno_id?: string | null }).turno_id;
    if (eid && tid) {
      addExpl(eid, tid);
      tieneHorario[eid] = true;
    }
  }

  // a) Turnos directos: TODAS las asignaciones (sin filtrar fecha) para detectar
  //    también horario que arranca en el futuro; la aplicabilidad de hoy se
  //    decide luego con vigente_desde y los días del turno.
  const { data: te } = await supabase
    .from("rrhh_turno_empleados")
    .select("empleado_id, turno_id, vigente_desde, vigente_hasta")
    .eq("empresa_id", empresaId)
    .in("empleado_id", empleadoIds);

  // b) Patrones: TODAS las asignaciones (sin filtrar fecha).
  const { data: pe } = await supabase
    .from("rrhh_patron_empleados")
    .select("empleado_id, patron_id, vigente_desde, vigente_hasta")
    .in("empleado_id", empleadoIds);
  const patronIds = [
    ...new Set(
      (pe ?? [])
        .map((r) => (r as { patron_id?: string }).patron_id)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  // Patrones "vivos": activos y no caducados (permite vigente_desde futuro).
  const patronInfo = new Map<
    string,
    { nombre: string; tipo: string; vigenteDesde: string | null }
  >();
  if (patronIds.length > 0) {
    const { data: patrones } = await supabase
      .from("rrhh_patrones")
      .select("id, nombre, tipo, vigente_desde, vigente_hasta")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", patronIds)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoyISO}`);
    for (const p of patrones ?? []) {
      const row = p as { id: string; nombre: string; tipo: string; vigente_desde: string | null };
      patronInfo.set(row.id, { nombre: row.nombre, tipo: row.tipo, vigenteDesde: row.vigente_desde });
    }
    const activos = [...patronInfo.keys()];
    if (activos.length > 0) {
      const { data: semanas } = await supabase
        .from("rrhh_patron_semanas")
        .select("patron_id, orden, dias")
        .in("patron_id", activos)
        .order("orden", { ascending: true });

      // Semanas de cada patrón, en su orden de rotación.
      const semanasPorPatron = new Map<string, (string | null)[][]>();
      for (const s of semanas ?? []) {
        const pid = (s as { patron_id: string }).patron_id;
        const lista = semanasPorPatron.get(pid) ?? [];
        lista.push(((s as { dias?: (string | null)[] }).dias ?? []) as (string | null)[]);
        semanasPorPatron.set(pid, lista);
      }

      // Turno de HOY de cada patrón: SOLO el de la semana que rige. Antes se
      // juntaban los turnos de TODAS las semanas en un mismo conjunto, así que
      // un patrón rotativo devolvía turnos de semanas que no tocaban.
      const turnoDiaPorPatron = new Map<string, Set<string>>();
      for (const [pid, lista] of semanasPorPatron) {
        if (lista.length === 0) continue;
        const idx = semanaQueRige(hoyISO, patronInfo.get(pid)?.vigenteDesde ?? null, lista.length);
        const tid = lista[idx]?.[weekday];
        if (tid) turnoDiaPorPatron.set(pid, new Set<string>([tid]));
      }
      for (const r of pe ?? []) {
        const eid = (r as { empleado_id?: string }).empleado_id;
        const pid = (r as { patron_id?: string }).patron_id;
        if (!eid || !pid) continue;
        const info = patronInfo.get(pid);
        if (!info) continue; // patrón inactivo o caducado
        // Si la ASIGNACIÓN ya terminó (p. ej. recortada por baja), no cuenta.
        const asigHasta = (r as { vigente_hasta?: string | null }).vigente_hasta ?? null;
        if (asigHasta != null && asigHasta < hoyISO) continue;
        tieneHorario[eid] = true; // patrón vivo asignado (aunque empiece en el futuro)
        const asigDesde = (r as { vigente_desde?: string | null }).vigente_desde ?? null;
        const aplicaHoy =
          (info.vigenteDesde == null || info.vigenteDesde <= hoyISO) &&
          (asigDesde == null || asigDesde <= hoyISO);
        if (aplicaHoy) {
          const tids = turnoDiaPorPatron.get(pid);
          if (tids) for (const tid of tids) addExpl(eid, tid); // celda del día (puede no haber → libre)
        }
      }
    }
  }
  // Detalle de los turnos referenciados (celdas de patrón + directos).
  const allTurnoIds = new Set<string>();
  for (const eid of empleadoIds) {
    for (const t of explicitos[eid] ?? []) allTurnoIds.add(t);
  }
  for (const d of te ?? []) {
    const tid = (d as { turno_id?: string | null }).turno_id;
    if (tid) allTurnoIds.add(tid);
  }
  type TurnoInfo = {
    nombre: string;
    tramos: Tramo[];
    tipoJornada: "fijo" | "flexible";
    flexHoras: Record<string, number>;
    flexHorasDia: number | null;
    flexModo: "diario" | "semanal";
    dias: string[];
    vigenteHasta: string | null;
  };
  const turnoInfo = new Map<string, TurnoInfo>();
  if (allTurnoIds.size > 0) {
    const { data: turnos } = await supabase
      .from("rrhh_turnos")
      .select("id, nombre, tramos, activo, tipo_jornada, flex_horas, flex_horas_dia, flex_modo, dias, vigente_hasta")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", [...allTurnoIds]);
    for (const t of turnos ?? []) {
      const row = t as {
        id: string;
        nombre?: string | null;
        tramos?: { inicio?: string; fin?: string }[];
        tipo_jornada?: string;
        flex_horas?: Record<string, number> | null;
        flex_horas_dia?: number | string | null;
        flex_modo?: string | null;
        dias?: string[] | null;
        vigente_hasta?: string | null;
      };
      const tramos: Tramo[] = [];
      for (const tr of row.tramos ?? []) {
        if (tr?.inicio && tr?.fin) tramos.push({ inicio: tr.inicio, fin: tr.fin });
      }
      turnoInfo.set(row.id, {
        nombre: row.nombre ?? "",
        tramos,
        tipoJornada: (row.tipo_jornada as "fijo" | "flexible") ?? "fijo",
        flexHoras: (row.flex_horas as Record<string, number> | null) ?? {},
        flexHorasDia: row.flex_horas_dia == null ? null : Number(row.flex_horas_dia),
        flexModo: (row.flex_modo as "diario" | "semanal") ?? "diario",
        dias: (row.dias as string[] | null) ?? [],
        vigenteHasta: row.vigente_hasta ?? null,
      });
    }
  }

  // Aplicabilidad de los turnos directos: el turno debe estar vivo (activo y no
  // caducado) → cuenta como horario asignado; aplica HOY si ya entró en vigor y
  // hoy es uno de sus días (los días entre medias quedan "Libre").
  for (const d of te ?? []) {
    const eid = (d as { empleado_id?: string }).empleado_id;
    const tid = (d as { turno_id?: string | null }).turno_id;
    if (!eid || !tid) continue;
    const info = turnoInfo.get(tid);
    if (!info) continue; // turno inactivo
    if (info.vigenteHasta != null && info.vigenteHasta < hoyISO) continue; // turno caducado
    // Si la ASIGNACIÓN del turno al empleado ya terminó (p. ej. recortada por
    // baja), tampoco cuenta como horario.
    const asigHasta = (d as { vigente_hasta?: string | null }).vigente_hasta ?? null;
    if (asigHasta != null && asigHasta < hoyISO) continue;
    tieneHorario[eid] = true;
    const asigDesde = (d as { vigente_desde?: string | null }).vigente_desde ?? null;
    const aplicaHoy =
      (asigDesde == null || asigDesde <= hoyISO) &&
      (info.dias.length === 0 || info.dias.includes(letra));
    if (aplicaHoy) addDir(eid, tid);
  }

  for (const eid of empleadoIds) {
    // `explicitos` y `directos` ya contienen solo turnos aplicables hoy.
    const todos = new Set<string>([...(explicitos[eid] ?? []), ...(directos[eid] ?? [])]);

    const tramosFijos: Tramo[] = [];
    let flexAplica: { objetivo: number; modo: "diario" | "semanal" } | null = null;
    // Nombre y tipo del TURNO de hoy (no del patrón): lo que toca trabajar este día.
    const nombresHoy: string[] = [];
    let tipoHoy: "fijo" | "flexible" | null = null;
    for (const tid of todos) {
      const info = turnoInfo.get(tid);
      if (!info) continue;
      if (info.nombre) nombresHoy.push(info.nombre);
      if (info.tipoJornada !== "flexible") {
        tramosFijos.push(...info.tramos);
        tipoHoy = "fijo";
      } else {
        if (tipoHoy == null) tipoHoy = "flexible";
        if (!flexAplica) {
          const objetivo =
            info.flexHorasDia != null
              ? info.flexHorasDia
              : info.flexModo === "semanal"
                ? Object.values(info.flexHoras).reduce((a, b) => a + (Number(b) || 0), 0)
                : Number(info.flexHoras[letra] ?? 0);
          const modo = info.flexHorasDia != null ? "diario" : info.flexModo;
          flexAplica = { objetivo, modo };
        }
      }
    }

    // Horas previstas hoy: si hoy descansa, queda null → la UI mostrará "Libre".
    let horasHoy: number | null = null;
    if (tramosFijos.length > 0) horasHoy = horasDeTramos(tramosFijos);
    else if (flexAplica) horasHoy = flexAplica.modo === "diario" ? flexAplica.objetivo : null;

    const nombre = nombresHoy.length > 0 ? [...new Set(nombresHoy)].join(" + ") : null;
    const tipoLabel = tipoHoy === "fijo" ? "Fijo" : tipoHoy === "flexible" ? "Flexible" : null;

    out.set(eid, { nombre, tipoLabel, horasHoy, tieneHorario: !!tieneHorario[eid] });
  }
  return out;
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
