"use server";

/**
 * Lo que RRHH ve y hace con las comunicaciones de una solicitud: el historial de
 * lo que ha salido, y el botón para volver a avisar a la gestoría cuando quedó
 * sin avisar (o cuando el correo falló).
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listarComunicaciones,
  gestoriaYaAvisada,
  type ComunicacionRegistrada,
} from "@/features/comunicaciones/services/registro";

const REF_TABLA = "solicitudes_personal";

export interface HistorialSolicitud {
  comunicaciones: ComunicacionRegistrada[];
  /** true = a la gestoría le consta un envío con éxito. */
  gestoriaAvisada: boolean;
  /** true = es una baja médica, que es donde el aviso a gestoría tiene sentido. */
  esBajaMedica: boolean;
}

/** Historial de una solicitud. Solo de la empresa activa. */
export async function getHistorialSolicitud(
  solicitudId: string,
): Promise<{ ok: boolean; data?: HistorialSolicitud; error?: string }> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();
    const { data: sol } = await admin
      .from("solicitudes_personal")
      .select("id, empresa_id, subtipo, estado")
      .eq("id", solicitudId)
      .maybeSingle();
    // Sin esta comprobación, un id de otra empresa devolvería su historial.
    if (!sol || sol.empresa_id !== empresaId) {
      return { ok: false, error: "Solicitud no encontrada" };
    }

    const [comunicaciones, avisada] = await Promise.all([
      listarComunicaciones(REF_TABLA, solicitudId),
      gestoriaYaAvisada(REF_TABLA, solicitudId),
    ]);

    return {
      ok: true,
      data: {
        comunicaciones,
        gestoriaAvisada: avisada,
        esBajaMedica: sol.subtipo === "baja_medica" && sol.estado === "aprobada",
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicaciones] getHistorialSolicitud:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Vuelve a mandar la baja médica a la gestoría.
 *
 * Sirve para los dos casos: se aprobó sin marcar la casilla, o se marcó y el
 * correo no salió. Cada reenvío crea un enlace nuevo y deja su propia línea en
 * el historial: así se ve cuántas veces se ha insistido.
 */
export async function reenviarBajaMedicaGestoria(
  solicitudId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, error: "No autenticado" };

    // Quién reenvía, para que quede con nombre en el historial.
    const { data: yo } = await supabase
      .from("usuarios")
      .select("nombre, apellidos")
      .eq("user_id", userId)
      .maybeSingle();
    const nombre =
      `${yo?.nombre ?? ""} ${yo?.apellidos ?? ""}`.trim() || "Recursos Humanos";

    const admin = createAdminClient();
    const { data: sol } = await admin
      .from("solicitudes_personal")
      .select("id, empresa_id, subtipo, estado")
      .eq("id", solicitudId)
      .maybeSingle();
    if (!sol || sol.empresa_id !== empresaId) {
      return { ok: false, error: "Solicitud no encontrada" };
    }
    if (sol.subtipo !== "baja_medica") {
      return { ok: false, error: "Esta solicitud no es una baja médica." };
    }
    // Una baja que aún no está aprobada no sale de la empresa: es justo la regla
    // que arregla este circuito.
    if (sol.estado !== "aprobada") {
      return { ok: false, error: "La baja todavía no está aprobada." };
    }

    const { enviarBajaMedicaGestoria } = await import(
      "@/features/rrhh/services/gestoria/baja-medica-gestoria"
    );
    const res = await enviarBajaMedicaGestoria({
      solicitudId,
      quien: { userId, nombre },
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicaciones] reenviarBajaMedicaGestoria:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Alta médica ────────────────────────────────────────────────────────────

export interface BajaMedicaAbierta {
  solicitudId: string;
  fechaInicio: string;
  /** Fecha aproximada que puso al pedirla. Solo orienta; no cierra nada. */
  fechaFinPrevista: string | null;
}

/**
 * ¿Tengo una baja médica abierta?
 *
 * Es lo que hace que el botón de Mi Panel cambie: mientras haya una baja
 * aprobada sin su alta, lo que toca no es pedir otra cosa, es comunicar el alta.
 */
export async function getMiBajaMedicaAbierta(): Promise<{
  ok: boolean;
  data: BajaMedicaAbierta | null;
}> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: true, data: null };

    const { data } = await supabase
      .from("solicitudes_personal")
      .select("id, fecha_inicio, fecha_fin")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .eq("subtipo", "baja_medica")
      .eq("estado", "aprobada")
      .is("alta_medica_comunicada_en", null)
      .order("fecha_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        solicitudId: data.id as string,
        fechaInicio: data.fecha_inicio as string,
        fechaFinPrevista: (data.fecha_fin as string | null) ?? null,
      },
    };
  } catch (err) {
    console.error(
      "[comunicaciones] getMiBajaMedicaAbierta:",
      err instanceof Error ? err.message : err,
    );
    return { ok: true, data: null };
  }
}

/**
 * El trabajador comunica su alta médica: cierra la baja, se calcula cuándo
 * vuelve según su horario, y se avisa a RRHH (programa y correo) y a la gestoría.
 */
export async function comunicarMiAltaMedica(
  solicitudId: string,
  fechaAltaIso: string,
): Promise<{ ok: boolean; error?: string; reincorporacion?: string | null }> {
  try {
    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };
    if (!fechaAltaIso) return { ok: false, error: "Indica la fecha en que te han dado el alta." };

    const { data: yo } = await supabase
      .from("usuarios")
      .select("nombre, apellidos")
      .eq("user_id", userId)
      .maybeSingle();
    const nombre = `${yo?.nombre ?? ""} ${yo?.apellidos ?? ""}`.trim() || "Trabajador";

    const { comunicarAltaMedica } = await import(
      "@/features/rrhh/services/gestoria/alta-medica"
    );
    const res = await comunicarAltaMedica({
      solicitudId,
      altaIso: fechaAltaIso,
      quien: { userId, nombre },
    });
    return res.ok
      ? { ok: true, reincorporacion: res.reincorporacion ?? null }
      : { ok: false, error: res.error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicaciones] comunicarMiAltaMedica:", msg);
    return { ok: false, error: msg };
  }
}
