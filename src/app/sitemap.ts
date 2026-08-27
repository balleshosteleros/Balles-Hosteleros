/**
 * Sitemap dinámico: lista todas las páginas PUBLICADAS con dominios VERIFICADOS.
 * Cada dominio custom se sirve como host propio, así que una sitemap global
 * sólo tiene sentido en el host principal (mostrar al crawler del SaaS).
 *
 * Las webs custom también exponen /sitemap.xml pero con sus URLs bajo su host
 * (esta ruta lo sirve para todos gracias a la resolución por hostname en layout).
 */
import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/anon";
import { SITIO_URL } from "./software/legal/datos-titular";

export const revalidate = 3600;

/**
 * Páginas del propio SaaS (no de las webs de clientes). Las legales entran
 * aquí porque la verificación de Google exige que la política de privacidad
 * sea públicamente accesible y rastreable.
 *
 * Las rutas son las CORTAS (`/legal/privacidad`), que es como las sirve
 * `software.balleshosteleros.com` y como están escritas en la pantalla de
 * consentimiento de Google. El rewrite de `next.config.ts` las traduce a
 * `/software/legal/...` por dentro.
 */
const PAGINAS_SAAS: MetadataRoute.Sitemap = [
  "/",
  "/legal/aviso-legal",
  "/legal/privacidad",
  "/legal/cookies",
  "/legal/terminos",
].map((path) => ({
  url: `${SITIO_URL}${path === "/" ? "" : path}`,
  lastModified: new Date(),
  changeFrequency: "monthly" as const,
  priority: path === "/" ? 1 : 0.3,
}));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("paginas_web_dominios")
      .select("hostname, pagina_id")
      .eq("estado", "VERIFICADO");
    if (error) return PAGINAS_SAAS;

    const urls: MetadataRoute.Sitemap = [...PAGINAS_SAAS];
    for (const row of (data ?? []) as Array<{ hostname: string }>) {
      urls.push({
        url: `https://${row.hostname}/`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    return urls;
  } catch (err) {
    console.error("[sitemap]", err);
    return PAGINAS_SAAS;
  }
}
