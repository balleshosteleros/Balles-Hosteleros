"use server";

/**
 * Acciones compartidas del BALANCE DE HORAS del mes (fuente única).
 *
 * Todas las vistas que muestran horas previstas vs fichadas (Pagos, Horarios de
 * la empresa, panel del trabajador) llaman aquí, para que el dato sea EXACTAMENTE
 * el mismo en todas partes y no varíe según dónde se mire. El cálculo vive en
 * `services/horas/horas-mes.ts`.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { horasMes, type HorasMesEmpleado } from "@/features/rrhh/services/horas/horas-mes";
import { getPlanificacionHorarios } from "@/features/rrhh/actions/planificacion-actions";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";

export type HorasMesRow = HorasMesEmpleado & { empleadoId: string };

/** Balance del mes para una LISTA de empleados (empresa: Pagos, Horarios). */
export async function loadHorasMes(
  periodo: string,
  empleadoIds: string[],
): Promise<{ ok: boolean; data: HorasMesRow[] }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    const ids = empleadoIds.filter((id) => id && !id.startsWith("ext-"));
    if (!empresaId || ids.length === 0) return { ok: true, data: [] };
    const mapa = await horasMes(supabase, empresaId, ids, periodo);
    const data: HorasMesRow[] = [];
    for (const [empleadoId, h] of mapa) data.push({ empleadoId, ...h });
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] loadHorasMes:", err);
    return { ok: false, data: [] };
  }
}

/** Balance del mes del TRABAJADOR logueado (su propia ficha de la empresa activa). */
export async function miBalanceHorasMes(
  periodo: string,
): Promise<{ ok: boolean; data: HorasMesEmpleado | null }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, data: null };
    const { data: emp } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const empleadoId = emp?.id as string | undefined;
    if (!empleadoId) return { ok: true, data: null };
    const mapa = await horasMes(supabase, empresaId, [empleadoId], periodo);
    return { ok: true, data: mapa.get(empleadoId) ?? null };
  } catch (err) {
    console.error("[rrhh] miBalanceHorasMes:", err);
    return { ok: false, data: null };
  }
}

// ---------------------------------------------------------------------------
// Fichajes del cuadrante: tramos fichados por empleado/día con su ORIGEN, para
// pintar las barras del cuadrante de Horarios (gris=previsto, verde=normal
// directo, azul=normal por solicitud, rojo=extra por solicitud).
// ---------------------------------------------------------------------------

export type OrigenFichaje = "directo" | "solicitud";

export interface TramoFichado {
  horaInicio: string; // "HH:MM" local
  horaFin: string | null; // null si el fichaje sigue abierto (sin salida)
  extra: boolean; // tipo EXT
  origen: OrigenFichaje; // solicitud_id != null → 'solicitud'
}

/** [empleadoId][fechaISO] → tramos fichados. */
export type FichadosCuadrante = Record<string, Record<string, TramoFichado[]>>;

/** "HH:MM" de un timestamptz en la zona de la empresa. null si no válido. */
function horaEnZonaHHMM(iso: string | null, tz: string): string | null {
  if (!iso) return null;
  const s = formatHoraEnZona(iso, tz, { hour12: false });
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null;
}

export async function loadFichajesCuadrante(
  empleadoIds: string[],
  desdeISO: string,
  hastaISO: string,
): Promise<{ ok: boolean; data: FichadosCuadrante }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    const ids = empleadoIds.filter((id) => id && !id.startsWith("ext-"));
    if (!empresaId || ids.length === 0) return { ok: true, data: {} };
    const tz = await getZonaHorariaEmpresa(supabase, empresaId);

    // empleados.id → user_id (fichajes usan user_id).
    const { data: emps } = await supabase
      .from("empleados")
      .select("id, user_id")
      .in("id", ids);
    const empByUser = new Map<string, string>();
    for (const e of emps ?? []) {
      const uid = e.user_id as string | null;
      if (uid) empByUser.set(uid, e.id as string);
    }
    const userIds = [...empByUser.keys()];
    if (userIds.length === 0) return { ok: true, data: {} };

    const { data: fichajes } = await supabase
      .from("fichajes")
      .select("empleado_id, fecha, hora_entrada, hora_salida, tipo, solicitud_id")
      .eq("empresa_id", empresaId)
      .in("empleado_id", userIds)
      .eq("estado", "completado")
      .gte("fecha", desdeISO)
      .lte("fecha", hastaISO);

    const out: FichadosCuadrante = {};
    for (const f of fichajes ?? []) {
      const eid = empByUser.get(f.empleado_id as string);
      if (!eid) continue;
      const fecha = f.fecha as string;
      const inicio = horaEnZonaHHMM(f.hora_entrada as string | null, tz);
      if (!inicio) continue; // sin entrada no hay tramo pintable
      const tramo: TramoFichado = {
        horaInicio: inicio,
        horaFin: horaEnZonaHHMM(f.hora_salida as string | null, tz),
        extra: (f.tipo as string) === "EXT",
        origen: f.solicitud_id ? "solicitud" : "directo",
      };
      ((out[eid] ??= {})[fecha] ??= []).push(tramo);
    }
    return { ok: true, data: out };
  } catch (err) {
    console.error("[rrhh] loadFichajesCuadrante:", err);
    return { ok: false, data: {} };
  }
}

// ---------------------------------------------------------------------------
// Timeline de Fichajes por DÍA (estilo Sesame): una fila por empleado con su
// horario previsto (gris) y sus fichajes (verde/azul/rojo). Reutiliza el
// previsto de la planificación y los fichados de loadFichajesCuadrante.
// ---------------------------------------------------------------------------

export interface TramoPrevisto {
  inicio: string;
  fin: string;
  turnoNombre: string | null; // nombre del turno (para el tooltip)
  turnoCodigo: string | null;
}

export interface TimelineFichajeRow {
  empleadoId: string;
  nombre: string;
  avatarUrl: string | null;
  departamento: string | null;
  previsto: TramoPrevisto[]; // tramos del horario (gris)
  fichado: TramoFichado[]; // tramos fichados (color por origen)
  horasPrevistas: number; // suma de tramos previstos del día
  horasFichadas: number; // suma de tramos fichados del día
}

/** Horas decimales de una lista de tramos "HH:MM" (resuelve cruce de medianoche). */
function horasDeTramosHHMM(tramos: { inicio: string; fin: string | null }[]): number {
  let total = 0;
  for (const t of tramos) {
    const m1 = /^(\d{1,2}):(\d{2})/.exec(t.inicio ?? "");
    const m2 = t.fin ? /^(\d{1,2}):(\d{2})/.exec(t.fin) : null;
    if (!m1 || !m2) continue;
    let ini = Number(m1[1]) * 60 + Number(m1[2]);
    let fin = Number(m2[1]) * 60 + Number(m2[2]);
    if (fin <= ini) fin += 1440;
    total += fin - ini;
  }
  return Math.round((total / 60) * 100) / 100;
}

/**
 * Datos del timeline de un DÍA: empleados (filtrables por cuadrante) con su
 * previsto y sus fichajes. `cuadranteId` acota por local/ámbito (opcional).
 */
export async function loadTimelineDia(
  fechaISO: string,
  cuadranteId?: string | null,
): Promise<{ ok: boolean; data: TimelineFichajeRow[] }> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    // Previsto + empleados del ámbito (reutiliza el motor de planificación).
    const plan = await getPlanificacionHorarios(empresaId, {
      desdeISO: fechaISO,
      hastaISO: fechaISO,
      cuadranteId: cuadranteId ?? undefined,
    });
    const planif = plan.data;
    const turnoById = new Map(planif.turnos.map((t) => [t.id, t]));
    const empleadoIds = planif.empleados.map((e) => e.empleadoId);
    if (empleadoIds.length === 0) return { ok: true, data: [] };

    // Fichados del día.
    const fich = await loadFichajesCuadrante(empleadoIds, fechaISO, fechaISO);
    const fichados = fich.data;

    const rows: TimelineFichajeRow[] = planif.empleados.map((e) => {
      const celdas = planif.celdas[e.empleadoId]?.[fechaISO] ?? [];
      const previsto: TramoPrevisto[] = celdas.flatMap((c) => {
        const t = turnoById.get(c.turnoId);
        if (!t) return [];
        return t.tramos.map((tr) => ({
          inicio: tr.inicio,
          fin: tr.fin,
          turnoNombre: t.nombre ?? null,
          turnoCodigo: t.codigo ?? null,
        }));
      });
      const fichado = fichados[e.empleadoId]?.[fechaISO] ?? [];
      return {
        empleadoId: e.empleadoId,
        nombre: e.nombreCompleto,
        avatarUrl: e.avatarUrl,
        departamento: e.departamento,
        previsto,
        fichado,
        horasPrevistas: horasDeTramosHHMM(previsto),
        horasFichadas: horasDeTramosHHMM(
          fichado.map((f) => ({ inicio: f.horaInicio, fin: f.horaFin })),
        ),
      };
    });
    rows.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return { ok: true, data: rows };
  } catch (err) {
    console.error("[rrhh] loadTimelineDia:", err);
    return { ok: false, data: [] };
  }
}
