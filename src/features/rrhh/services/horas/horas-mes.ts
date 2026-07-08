import "server-only";

/**
 * Horas del MES por empleado para el módulo de Pagos:
 *   • horasTeoricasMes  → lo que DEBERÍA trabajar según su horario (patrón + turno
 *                          directo + planificación), sumando los días del mes.
 *   • horasFichadasMes  → lo que HA fichado (suma de fichajes.horas_totales).
 *
 * Ambas son batcheadas (una tanda de queries para todos los empleados, sin N+1).
 * El teórico reutiliza el mismo modelo de datos que `resolverHorarioResumen`
 * (utils/horario-empleado): carga turnos/patrones/semanas UNA vez y recorre los
 * días del mes; la celda del patrón depende solo del día de la semana.
 *
 * Flexibles: los de objetivo DIARIO suman su objetivo cada día que aplican; los
 * de objetivo SEMANAL se prorratean = objetivo_semanal × (nº semanas del mes).
 * Fichados: se suman TODOS los fichajes del mes (sin filtrar por estado).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface HorasMesEmpleado {
  teoricas: number; // horas previstas por su horario en el mes (decimal)
  fichadas: number; // horas fichadas reales en el mes (decimal)
}

const LETRAS_DIA = ["L", "M", "X", "J", "V", "S", "D"] as const;

/** Índice de día lunes=0 … domingo=6 desde "YYYY-MM-DD". */
function indexLunes(fechaISO: string): number {
  const d = new Date(`${fechaISO}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

/** Minutos del día (0–1439) desde "HH:MM". null si no válido. */
function hhmmAMinutos(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** Horas decimales de una lista de tramos (resuelve cruce de medianoche). */
function horasDeTramos(tramos: { inicio: string; fin: string }[]): number {
  let total = 0;
  for (const tr of tramos) {
    const ini = hhmmAMinutos(tr.inicio);
    let fin = hhmmAMinutos(tr.fin);
    if (ini == null || fin == null) continue;
    if (fin <= ini) fin += 1440;
    total += fin - ini;
  }
  return total / 60;
}

/** Primer y último día del periodo 'YYYY-MM' como 'YYYY-MM-DD'. */
function rangoMes(periodo: string): { desde: string; hasta: string; dias: string[] } {
  const [y, m] = periodo.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate(); // día 0 del mes siguiente = último del actual
  const dias: string[] = [];
  for (let d = 1; d <= ultimoDia; d++) {
    dias.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return { desde: dias[0], hasta: dias[dias.length - 1], dias };
}

/** Nº de semanas (parciales incluidas) que toca el mes, para prorratear flexibles semanales. */
function semanasDelMes(dias: string[]): number {
  return dias.length / 7;
}

type TurnoInfo = {
  tramos: { inicio: string; fin: string }[];
  tipoJornada: "fijo" | "flexible";
  flexHoras: Record<string, number>;
  flexHorasDia: number | null;
  flexModo: "diario" | "semanal";
  dias: string[];
  vigenteHasta: string | null;
};

/**
 * Horas TEÓRICAS del mes por empleado. Carga el modelo una vez y recorre los días.
 * Devuelve un Map empleadoId → horas (decimal). Los empleados sin horario → 0.
 */
export async function horasTeoricasMes(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoIds: string[],
  periodo: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (empleadoIds.length === 0) return out;
  for (const eid of empleadoIds) out.set(eid, 0);

  const { desde, hasta, dias } = rangoMes(periodo);

  // ── Cargar el modelo UNA vez ───────────────────────────────────────────────
  // a) Turnos directos por empleado (vigentes en algún momento del mes).
  const { data: te } = await supabase
    .from("rrhh_turno_empleados")
    .select("empleado_id, turno_id, vigente_desde")
    .eq("empresa_id", empresaId)
    .in("empleado_id", empleadoIds)
    .lte("vigente_desde", hasta);

  // b) Patrones por empleado.
  const { data: pe } = await supabase
    .from("rrhh_patron_empleados")
    .select("empleado_id, patron_id, vigente_desde")
    .in("empleado_id", empleadoIds)
    .lte("vigente_desde", hasta);
  const patronIds = [
    ...new Set((pe ?? []).map((r) => (r as { patron_id?: string }).patron_id).filter((x): x is string => !!x)),
  ];

  // c) Planificación concreta del mes (turnos por fecha exacta).
  const { data: planif } = await supabase
    .from("rrhh_planificacion")
    .select("empleado_id, turno_id, fecha")
    .eq("empresa_id", empresaId)
    .in("empleado_id", empleadoIds)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  // d) Patrones vivos (activos, no caducados durante el mes) + sus semanas.
  const patronVigencia = new Map<string, { vigenteDesde: string | null; vigenteHasta: string | null }>();
  const turnoDiaPorPatron = new Map<string, Map<number, Set<string>>>(); // patron → weekday → turnoIds
  if (patronIds.length > 0) {
    const { data: patrones } = await supabase
      .from("rrhh_patrones")
      .select("id, vigente_desde, vigente_hasta")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", patronIds)
      .lte("vigente_desde", hasta)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${desde}`);
    for (const p of patrones ?? []) {
      const row = p as { id: string; vigente_desde: string | null; vigente_hasta: string | null };
      patronVigencia.set(row.id, { vigenteDesde: row.vigente_desde, vigenteHasta: row.vigente_hasta });
    }
    const activos = [...patronVigencia.keys()];
    if (activos.length > 0) {
      const { data: semanas } = await supabase
        .from("rrhh_patron_semanas")
        .select("patron_id, dias")
        .in("patron_id", activos);
      for (const s of semanas ?? []) {
        const pid = (s as { patron_id: string }).patron_id;
        const diasArr = ((s as { dias?: (string | null)[] }).dias ?? []) as (string | null)[];
        const porDia = turnoDiaPorPatron.get(pid) ?? new Map<number, Set<string>>();
        for (let wd = 0; wd < 7; wd++) {
          const tid = diasArr[wd];
          if (tid) (porDia.get(wd) ?? porDia.set(wd, new Set()).get(wd)!).add(tid);
        }
        turnoDiaPorPatron.set(pid, porDia);
      }
    }
  }

  // e) Detalle de todos los turnos referenciados (directos + patrón + planif).
  const allTurnoIds = new Set<string>();
  for (const d of te ?? []) {
    const tid = (d as { turno_id?: string | null }).turno_id;
    if (tid) allTurnoIds.add(tid);
  }
  for (const p of planif ?? []) {
    const tid = (p as { turno_id?: string | null }).turno_id;
    if (tid) allTurnoIds.add(tid);
  }
  for (const porDia of turnoDiaPorPatron.values()) {
    for (const set of porDia.values()) for (const tid of set) allTurnoIds.add(tid);
  }
  const turnoInfo = new Map<string, TurnoInfo>();
  if (allTurnoIds.size > 0) {
    const { data: turnos } = await supabase
      .from("rrhh_turnos")
      .select("id, tramos, activo, tipo_jornada, flex_horas, flex_horas_dia, flex_modo, dias, vigente_hasta")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .in("id", [...allTurnoIds]);
    for (const t of turnos ?? []) {
      const row = t as {
        id: string;
        tramos?: { inicio?: string; fin?: string }[];
        tipo_jornada?: string;
        flex_horas?: Record<string, number> | null;
        flex_horas_dia?: number | string | null;
        flex_modo?: string | null;
        dias?: string[] | null;
        vigente_hasta?: string | null;
      };
      const tramos: { inicio: string; fin: string }[] = [];
      for (const tr of row.tramos ?? []) if (tr?.inicio && tr?.fin) tramos.push({ inicio: tr.inicio, fin: tr.fin });
      turnoInfo.set(row.id, {
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

  // Indexar asignaciones por empleado.
  const directosPorEmp = new Map<string, { turnoId: string; desde: string | null }[]>();
  for (const d of te ?? []) {
    const eid = (d as { empleado_id?: string }).empleado_id;
    const tid = (d as { turno_id?: string | null }).turno_id;
    if (!eid || !tid) continue;
    (directosPorEmp.get(eid) ?? directosPorEmp.set(eid, []).get(eid)!).push({
      turnoId: tid,
      desde: (d as { vigente_desde?: string | null }).vigente_desde ?? null,
    });
  }
  const patronesPorEmp = new Map<string, { patronId: string; desde: string | null }[]>();
  for (const r of pe ?? []) {
    const eid = (r as { empleado_id?: string }).empleado_id;
    const pid = (r as { patron_id?: string }).patron_id;
    if (!eid || !pid) continue;
    (patronesPorEmp.get(eid) ?? patronesPorEmp.set(eid, []).get(eid)!).push({
      patronId: pid,
      desde: (r as { vigente_desde?: string | null }).vigente_desde ?? null,
    });
  }
  const planifPorEmpFecha = new Map<string, string[]>(); // `${eid}|${fecha}` → turnoIds
  for (const p of planif ?? []) {
    const eid = (p as { empleado_id?: string }).empleado_id;
    const tid = (p as { turno_id?: string | null }).turno_id;
    const fecha = (p as { fecha?: string }).fecha;
    if (!eid || !tid || !fecha) continue;
    const k = `${eid}|${fecha}`;
    (planifPorEmpFecha.get(k) ?? planifPorEmpFecha.set(k, []).get(k)!).push(tid);
  }

  // Flexibles semanales: se prorratean por semanas del mes (fuera del bucle diario).
  const nSemanas = semanasDelMes(dias);

  // ── Recorrer los días del mes por empleado ─────────────────────────────────
  for (const eid of empleadoIds) {
    let horas = 0;
    // Flexibles semanales acumulados (una vez por mes, prorrateados).
    const flexSemanalObjetivos: number[] = [];

    for (const fecha of dias) {
      const weekday = indexLunes(fecha);
      const letra = LETRAS_DIA[weekday];

      // Turnos explícitos del día: planificación + celda del patrón vigente.
      const explicitos = new Set<string>();
      for (const tid of planifPorEmpFecha.get(`${eid}|${fecha}`) ?? []) explicitos.add(tid);
      for (const { patronId, desde } of patronesPorEmp.get(eid) ?? []) {
        const vig = patronVigencia.get(patronId);
        if (!vig) continue; // inactivo/caducado
        if (vig.vigenteDesde != null && vig.vigenteDesde > fecha) continue;
        if (vig.vigenteHasta != null && vig.vigenteHasta < fecha) continue;
        if (desde != null && desde > fecha) continue;
        for (const tid of turnoDiaPorPatron.get(patronId)?.get(weekday) ?? []) explicitos.add(tid);
      }
      // Turnos directos aplicables hoy.
      const directos = new Set<string>();
      for (const { turnoId, desde } of directosPorEmp.get(eid) ?? []) {
        const info = turnoInfo.get(turnoId);
        if (!info) continue;
        if (info.vigenteHasta != null && info.vigenteHasta < fecha) continue;
        if (desde != null && desde > fecha) continue;
        if (info.tipoJornada === "flexible" && info.dias.length > 0 && !info.dias.includes(letra)) continue;
        directos.add(turnoId);
      }

      const todos = new Set<string>([...explicitos, ...directos]);
      if (todos.size === 0) continue;

      // Igual que getHorarioDia: mandan los fijos; si no, flexible.
      const tramosFijos: { inicio: string; fin: string }[] = [];
      let flexDia: number | null = null;
      for (const tid of todos) {
        const info = turnoInfo.get(tid);
        if (!info) continue;
        if (info.tipoJornada !== "flexible") {
          tramosFijos.push(...info.tramos);
        } else if (flexDia == null && flexSemanalObjetivos.length === 0) {
          if (info.flexHorasDia != null) flexDia = info.flexHorasDia;
          else if (info.flexModo === "semanal") {
            const objetivo = Object.values(info.flexHoras).reduce((a, b) => a + (Number(b) || 0), 0);
            if (objetivo > 0 && !flexSemanalObjetivos.includes(objetivo)) flexSemanalObjetivos.push(objetivo);
          } else {
            flexDia = Number(info.flexHoras[letra] ?? 0);
          }
        }
      }
      if (tramosFijos.length > 0) horas += horasDeTramos(tramosFijos);
      else if (flexDia != null) horas += flexDia;
    }

    // Prorrateo de flexibles semanales: objetivo_semanal × semanas del mes.
    for (const objetivo of flexSemanalObjetivos) horas += objetivo * nSemanas;

    out.set(eid, Math.round(horas * 100) / 100);
  }

  return out;
}

/**
 * Horas FICHADAS del mes por empleado. Suma `fichajes.horas_totales` de TODOS los
 * fichajes del mes. Ojo: `fichajes.empleado_id` es el `user_id` (auth), así que
 * primero resolvemos empleadoId → user_id.
 */
export async function horasFichadasMes(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoIds: string[],
  periodo: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (empleadoIds.length === 0) return out;
  for (const eid of empleadoIds) out.set(eid, 0);

  const { desde, hasta } = rangoMes(periodo);

  // empleadoId → user_id (fichajes usan user_id).
  const { data: emps } = await supabase
    .from("empleados")
    .select("id, user_id")
    .in("id", empleadoIds);
  const userByEmp = new Map<string, string>();
  const empByUser = new Map<string, string>();
  for (const e of emps ?? []) {
    const id = e.id as string;
    const uid = e.user_id as string | null;
    if (uid) {
      userByEmp.set(id, uid);
      empByUser.set(uid, id);
    }
  }
  const userIds = [...userByEmp.values()];
  if (userIds.length === 0) return out;

  const { data: fichajes } = await supabase
    .from("fichajes")
    .select("empleado_id, horas_totales")
    .eq("empresa_id", empresaId)
    .in("empleado_id", userIds)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  for (const f of fichajes ?? []) {
    const uid = f.empleado_id as string;
    const eid = empByUser.get(uid);
    if (!eid) continue;
    out.set(eid, Math.round((out.get(eid)! + Number(f.horas_totales ?? 0)) * 100) / 100);
  }
  return out;
}

/** Conveniencia: ambas de una vez. */
export async function horasMes(
  supabase: SupabaseClient,
  empresaId: string,
  empleadoIds: string[],
  periodo: string,
): Promise<Map<string, HorasMesEmpleado>> {
  const [teoricas, fichadas] = await Promise.all([
    horasTeoricasMes(supabase, empresaId, empleadoIds, periodo),
    horasFichadasMes(supabase, empresaId, empleadoIds, periodo),
  ]);
  const out = new Map<string, HorasMesEmpleado>();
  for (const eid of empleadoIds) {
    out.set(eid, { teoricas: teoricas.get(eid) ?? 0, fichadas: fichadas.get(eid) ?? 0 });
  }
  return out;
}
