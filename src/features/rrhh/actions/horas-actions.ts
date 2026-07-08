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
