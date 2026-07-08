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

/** "HH:MM" local de un timestamptz/ISO. null si no válido. */
function horaLocalHHMM(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
      const inicio = horaLocalHHMM(f.hora_entrada as string | null);
      if (!inicio) continue; // sin entrada no hay tramo pintable
      const tramo: TramoFichado = {
        horaInicio: inicio,
        horaFin: horaLocalHHMM(f.hora_salida as string | null),
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
