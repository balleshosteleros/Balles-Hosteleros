import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Zonas en las que SÍ se puede sentar a un cliente en un local.
 *
 * Regla del dueño: el cliente reserva eligiendo un GRUPO de zonas (lo que ve
 * publicado: "Sala", "Terraza Interior"…), y cada grupo engloba varias zonas
 * internas. Una zona que no está en ningún grupo activo NO es reservable —
 * la barra de BACANAL, por ejemplo — así que la asignación automática no
 * puede colocar ahí a nadie, ni siquiera cuando la reserva no pide zona.
 *
 * Devuelve `null` cuando el local todavía no tiene grupos configurados: sin
 * publicación definida no hay nada que restringir y manda el plano entero.
 */
export async function getZonasReservables(
  supabase: SupabaseClient,
  localId: string,
): Promise<Set<string> | null> {
  try {
    const { data: grupos, error } = await supabase
      .from("grupos_zonas")
      .select("id")
      .eq("local_id", localId)
      .eq("activa", true);
    if (error) throw error;
    const ids = (grupos ?? []).map((g) => g.id as string);
    if (ids.length === 0) return null;

    const { data: rel, error: errRel } = await supabase
      .from("grupo_zona_zonas")
      .select("zona_id")
      .in("grupo_zona_id", ids);
    if (errRel) throw errRel;

    const zonas = new Set((rel ?? []).map((r) => r.zona_id as string));
    return zonas.size > 0 ? zonas : null;
  } catch (err) {
    // Un fallo leyendo la publicación no debe tumbar la reserva: se sigue con
    // el plano entero, que es el comportamiento previo.
    console.error("[zonas-reservables]", err);
    return null;
  }
}
