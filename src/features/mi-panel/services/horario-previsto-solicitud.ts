import "server-only";

/**
 * Resuelve, para cada solicitud de DÍA TRABAJADO, el turno que el empleado
 * tenía asignado ese día y si coincide con lo que pide.
 *
 * Quien valida no puede saber de memoria el cuadrante de cada persona. Antes
 * tenía que abrirse Horarios en otra pestaña y comparar a ojo; aquí la
 * comparación llega hecha.
 *
 * Solo se resuelve el día trabajado: es un día que el empleado debería haber
 * fichado, así que tiene horario con el que contrastar. Las horas extras se
 * hacen FUERA del turno por definición —no existe un previsto contra el que
 * medirlas—, así que se dejan sin resolver y la columna sale vacía.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getHorarioDia,
  getDiasConHorarioAsignado,
} from "@/features/rrhh/utils/horario-empleado";
import type { HorarioPrevistoSolicitud } from "@/features/mi-panel/types";

/** Lo mínimo que hace falta de una solicitud para resolver su previsto. */
export interface SolicitudParaPrevisto {
  id: string;
  empresaId: string;
  userId: string;
  subtipo: string;
  fechaInicio: string;
  horaInicio: string | null;
  horaFin: string | null;
}

/** "HH:MM[:SS]" → "HH:MM". Las horas de BD llegan con segundos. */
function hhmm(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/**
 * Empleado de cada `user_id` dentro de UNA empresa. El horario cuelga del
 * `empleados.id`, no del usuario: una persona en dos empresas tiene dos fichas
 * y dos cuadrantes, y la solicitud pertenece a una empresa concreta.
 */
async function empleadosPorUsuario(
  supabase: SupabaseClient,
  empresaId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (userIds.length === 0) return mapa;
  const { data } = await supabase
    .from("empleados")
    .select("id, user_id")
    .eq("empresa_id", empresaId)
    .in("user_id", userIds);
  for (const r of data ?? []) {
    const uid = (r as { user_id: string | null }).user_id;
    if (uid) mapa.set(uid, (r as { id: string }).id);
  }
  return mapa;
}

/**
 * Añade `horarioPrevistoDia` a las solicitudes de día trabajado.
 *
 * Devuelve un mapa por id de solicitud; las que no aplican no aparecen, y la
 * columna se queda vacía. Nunca lanza: un fallo resolviendo el cuadrante no
 * puede dejar sin lista a quien valida.
 */
export async function horariosPrevistosDeSolicitudes(
  supabase: SupabaseClient,
  empresaId: string,
  solicitudes: SolicitudParaPrevisto[],
): Promise<Map<string, HorarioPrevistoSolicitud>> {
  const out = new Map<string, HorarioPrevistoSolicitud>();
  const aplicables = solicitudes.filter((s) => s.subtipo === "dia_trabajado");
  if (aplicables.length === 0) return out;

  try {
    const empleadoPorUser = await empleadosPorUsuario(
      supabase,
      empresaId,
      Array.from(new Set(aplicables.map((s) => s.userId))),
    );

    for (const sol of aplicables) {
      const empleadoId = empleadoPorUser.get(sol.userId);
      if (!empleadoId) continue;

      // "Libra ese día" y "no tiene horario puesto" son cosas distintas, y el
      // motor devuelve 'ninguno' en las dos. La vigencia de la asignación es
      // lo que las separa: sin ella no se afirma nada y la columna va vacía.
      const cubiertos = await getDiasConHorarioAsignado(
        supabase,
        empresaId,
        empleadoId,
        sol.fechaInicio,
        sol.fechaInicio,
      );
      if (!cubiertos.has(sol.fechaInicio)) continue;

      const h = await getHorarioDia(supabase, empresaId, empleadoId, sol.fechaInicio);

      if (h.tipo === "fijo" && h.tramos.length > 0) {
        const texto = h.tramos.map((t) => `${t.inicio}–${t.fin}`).join(", ");
        const ini = hhmm(sol.horaInicio);
        const fin = hhmm(sol.horaFin);
        // Coincide = entrada Y salida exactas contra alguno de sus tramos.
        // Un día partido tiene dos turnos y se pide uno de los dos, así que
        // basta con que encaje en uno.
        const coincide =
          ini && fin
            ? h.tramos.some((t) => hhmm(t.inicio) === ini && hhmm(t.fin) === fin)
            : null;
        out.set(sol.id, { trabaja: true, texto, coincide });
        continue;
      }

      if (h.tipo === "flexible" && h.objetivoHoras > 0) {
        // Jornada flexible: hay horas que cumplir, pero no una hora de entrada
        // ni de salida. No hay contra qué comparar el tramo, así que se enseña
        // el objetivo y la columna de coincidencia se queda vacía.
        out.set(sol.id, {
          trabaja: true,
          texto: `${h.objetivoHoras} h (flexible)`,
          coincide: null,
        });
        continue;
      }

      // Tiene horario asignado y ese día no le tocaba: libraba. Pedir un día
      // trabajado en un día libre es justo lo que hay que ver, así que es una
      // discrepancia, no un dato ausente.
      out.set(sol.id, { trabaja: false, texto: "", coincide: false });
    }
  } catch (err) {
    console.error("[mi-panel] horariosPrevistosDeSolicitudes:", err);
  }

  return out;
}
