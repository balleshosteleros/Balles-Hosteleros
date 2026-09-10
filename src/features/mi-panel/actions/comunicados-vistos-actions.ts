"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Dar por visto un comunicado que el trabajador acaba de leer.
 *
 * El «visto» no se guarda en el comunicado, sino en el aviso que recibió cada
 * uno: es lo que ya distingue a una persona de otra. De ahí sale el alcance que
 * ve quien lo publicó.
 *
 * Antes solo contaba pulsar «Entendido» en el aviso emergente, así que abrir el
 * comunicado y leerlo entero no dejaba rastro: el alcance se quedaba al 0 %
 * aunque lo hubiera leído todo el mundo.
 *
 * No pisa la fecha si ya estaba visto: interesa CUÁNDO se vio la primera vez.
 */
export async function marcarComunicadosVistos(
  comunicadoIds: string[],
): Promise<{ ok: boolean }> {
  try {
    const ids = comunicadoIds.filter(Boolean);
    if (ids.length === 0) return { ok: true };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { error } = await supabase
      .from("notificaciones")
      .update({ vista_at: new Date().toISOString() })
      .eq("usuario_id", user.id)
      .eq("entidad_tipo", "comunicados")
      .in("entidad_id", ids)
      .is("vista_at", null);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[mi-panel] marcarComunicadosVistos:", e);
    return { ok: false };
  }
}
