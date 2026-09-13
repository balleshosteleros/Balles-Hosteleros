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

/**
 * Pulgar arriba / pulgar abajo de un comunicado.
 *
 * `meGusta` a `null` retira el voto: se puede quitar en cualquier momento y el
 * recuento baja al instante. Volver a votar cambia el voto en vez de sumar
 * otro, porque la clave de la tabla es la pareja comunicado + persona.
 *
 * Es solo un termómetro: no dispara avisos ni tareas: la empresa lo mira y ya.
 */
export async function valorarComunicado(
  comunicadoId: string,
  meGusta: boolean | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!comunicadoId) return { ok: false, error: "Falta el comunicado." };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    if (meGusta === null) {
      const { error } = await supabase
        .from("comunicado_valoraciones")
        .delete()
        .eq("comunicado_id", comunicadoId)
        .eq("usuario_id", user.id);
      if (error) throw error;
      return { ok: true };
    }

    const { error } = await supabase.from("comunicado_valoraciones").upsert(
      {
        comunicado_id: comunicadoId,
        usuario_id: user.id,
        me_gusta: meGusta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "comunicado_id,usuario_id" },
    );
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[mi-panel] valorarComunicado:", e);
    return { ok: false, error: "No se pudo guardar tu valoración." };
  }
}
