/**
 * Resuelve un dominio de cliente a los slugs de SUS portales públicos.
 *
 * POR QUÉ EXISTE:
 * Las rutas públicas llevan el slug de la empresa dentro (`/carta/bacanal`).
 * Eso es imprescindible en el dominio del software, donde conviven todas las
 * empresas — pero en el dominio del propio restaurante sobra: repetir el
 * nombre da `bacanalmadrid.com/carta/bacanal`, que es feo y es la URL que el
 * cliente ve impresa en el QR de la mesa.
 *
 * Con esto, en un dominio de cliente basta `bacanalmadrid.com/carta`: el proxy
 * completa el slug solo. Funciona para cualquier empresa presente y futura sin
 * tocar código: en cuanto un dominio queda VERIFICADO, sus portales responden
 * en él. Nadie tiene que activarlos uno a uno.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizarHost } from "./hostname-resolver";

export interface SlugsDominio {
  empresaId: string;
  /** Slug de la carta digital. `null` si la empresa no tiene carta. */
  cartaSlug: string | null;
  /** Slug del portal de empleo. */
  empleoSlug: string | null;
  /** Slug general de la empresa (reservas, tienda, visita). */
  empresaSlug: string | null;
}

/**
 * Caché en memoria del proceso. El proxy corre en CADA petición: sin esto,
 * abrir la carta costaría una consulta extra a la BD por visita, en la ruta
 * más caliente que hay (el QR de la mesa un sábado noche).
 *
 * TTL corto a propósito: si alguien cambia el slug desde el panel, la URL nueva
 * empieza a funcionar en menos de un minuto sin redesplegar.
 */
const CACHE = new Map<string, { valor: SlugsDominio | null; expira: number }>();
const TTL_MS = 60_000;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Slugs de la empresa dueña de `rawHost`, o `null` si el dominio no está
 * verificado (o no es de ninguna empresa).
 */
export async function slugsDeDominio(rawHost: string): Promise<SlugsDominio | null> {
  const hostname = normalizarHost(rawHost);
  if (!hostname) return null;

  const cacheado = CACHE.get(hostname);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.valor;

  let valor: SlugsDominio | null = null;
  try {
    const supabase = serviceClient();

    // `paginas_web_dominios` guarda el dominio; la empresa cuelga de la página.
    const { data: dom } = await supabase
      .from("paginas_web_dominios")
      .select("pagina_id")
      .eq("hostname", hostname)
      .eq("estado", "VERIFICADO")
      .maybeSingle();

    const paginaId = (dom as { pagina_id?: string } | null)?.pagina_id;
    if (paginaId) {
      const { data: pag } = await supabase
        .from("paginas_web")
        .select("empresa_id")
        .eq("id", paginaId)
        .maybeSingle();

      const empresaId = (pag as { empresa_id?: string } | null)?.empresa_id;
      if (empresaId) {
        const { data: emp } = await supabase
          .from("empresas")
          .select("id, carta_slug, empleo_slug, slug")
          .eq("id", empresaId)
          .maybeSingle();

        if (emp) {
          const e = emp as {
            id: string;
            carta_slug: string | null;
            empleo_slug: string | null;
            slug: string | null;
          };
          valor = {
            empresaId: e.id,
            cartaSlug: e.carta_slug,
            empleoSlug: e.empleo_slug ?? e.slug,
            empresaSlug: e.slug,
          };
        }
      }
    }
  } catch (err) {
    // Nunca tumbar la petición por esto: sin slugs, la ruta sigue su camino
    // normal (con slug explícito), que es lo que hacía antes de existir esto.
    console.error("[slugs-dominio] fatal:", err);
    return null;
  }

  CACHE.set(hostname, { valor, expira: Date.now() + TTL_MS });
  return valor;
}

/**
 * Portales que se sirven SIN slug en el dominio del cliente, y de qué slug tira
 * cada uno. El dominio ya dice de qué empresa es la carta.
 */
export const PORTALES_SIN_SLUG: Array<{
  ruta: string;
  slug: (s: SlugsDominio) => string | null;
}> = [
  { ruta: "/carta", slug: (s) => s.cartaSlug },
  { ruta: "/empleo", slug: (s) => s.empleoSlug },
  { ruta: "/reservar", slug: (s) => s.empresaSlug },
  { ruta: "/comprar", slug: (s) => s.empresaSlug },
];
