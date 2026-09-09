import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Enlace que abre directamente el cuadro de "escribir reseña" de Google para
 * un local. Es el que se le ofrece al cliente que acaba de poner 5 estrellas.
 *
 * POR QUÉ EXISTE: la redirección a Google ya estaba programada, pero exigía que
 * alguien pegara a mano la URL en `visita_config.google_review_url`, y nadie lo
 * hizo nunca: a 09-09-2026 estaba vacía en las dos empresas, así que la función
 * no se había disparado una sola vez pese a estar activada en HABANA.
 *
 * No hace falta pedir esa URL: se deriva del `google_place_id` que la empresa ya
 * tiene configurado para las reseñas y para el canal de Google. Así un local
 * nuevo lo hereda sin configurar nada, que es la regla del producto.
 *
 * La URL escrita a mano sigue mandando: si alguien pone una concreta (por
 * ejemplo un enlace corto de campaña), se respeta.
 */
export function urlEscribirResenaDesdePlaceId(placeId: string | null | undefined): string | null {
  const id = placeId?.trim();
  if (!id) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`;
}

/**
 * Resuelve el enlace de reseña de una empresa: primero el configurado a mano y,
 * si no hay, el derivado de su ficha de Google. `null` si el local todavía no
 * tiene ficha conectada.
 */
export async function urlResenaGoogleDeEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
  urlConfigurada?: string | null,
): Promise<string | null> {
  const manual = urlConfigurada?.trim();
  if (manual) return manual;

  const { data } = await supabase
    .from("empresas")
    .select("google_place_id")
    .eq("id", empresaId)
    .maybeSingle();

  return urlEscribirResenaDesdePlaceId(data?.google_place_id as string | null);
}
