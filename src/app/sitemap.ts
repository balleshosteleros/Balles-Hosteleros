/**
 * Sitemap POR DOMINIO.
 *
 * POR QUÉ IMPORTA:
 * Esta ruta la sirven todos los hosts a la vez (el del software y el de cada
 * restaurante). Antes devolvía siempre la misma lista —las páginas del SaaS
 * más la portada de cada cliente—, sin mirar quién preguntaba: así,
 * `bacanalmadrid.com/sitemap.xml` le decía a Google que ese dominio contenía
 * `software.balleshosteleros.com`. Es justo lo contrario de lo que se busca:
 * el restaurante quiere posicionar SU marca, no la del proveedor.
 *
 * Ahora cada dominio anuncia SOLO lo suyo:
 *   - dominio de cliente → su portada, sus páginas del CMS y sus portales
 *     (carta, reservas, empleo) con las URLs cortas del propio dominio.
 *   - host principal → las páginas del SaaS.
 */
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizarHost } from "@/features/marketing/pagina-web/services/hostname-resolver";
import { SITIO_URL } from "./software/legal/datos-titular";

export const revalidate = 3600;

/**
 * Páginas del propio SaaS (no de las webs de clientes). Las legales entran
 * aquí porque la verificación de Google exige que la política de privacidad
 * sea públicamente accesible y rastreable.
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

/**
 * Portales públicos que cuelgan del dominio del cliente. Se anuncian con la URL
 * CORTA (`/carta`), que es la que se quiere posicionar y la que va impresa en
 * el QR de la mesa — no la larga con el slug repetido.
 */
const PORTALES = [
  { ruta: "/carta", campo: "carta_slug" as const, prioridad: 0.9 },
  { ruta: "/reservar", campo: "slug" as const, prioridad: 0.8 },
  { ruta: "/empleo", campo: "empleo_slug" as const, prioridad: 0.5 },
];

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const cab = await headers();
    const host = normalizarHost(
      cab.get("x-forwarded-host") ?? cab.get("host") ?? "",
    );
    if (!host) return PAGINAS_SAAS;

    const supabase = serviceClient();

    const { data: dom } = await supabase
      .from("paginas_web_dominios")
      .select("pagina_id")
      .eq("hostname", host)
      .eq("estado", "VERIFICADO")
      .maybeSingle();

    // No es dominio de cliente: es el host del software.
    const paginaId = (dom as { pagina_id?: string } | null)?.pagina_id;
    if (!paginaId) return PAGINAS_SAAS;

    const { data: pagInicio } = await supabase
      .from("paginas_web")
      .select("empresa_id")
      .eq("id", paginaId)
      .maybeSingle();

    const empresaId = (pagInicio as { empresa_id?: string } | null)?.empresa_id;
    if (!empresaId) return [];

    const base = `https://${host}`;
    const urls: MetadataRoute.Sitemap = [
      {
        url: `${base}/`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1,
      },
    ];

    // Páginas del CMS de ESTA empresa (legales y cualquier otra publicada).
    // La portada ya va arriba, así que se excluye por id.
    const { data: paginas } = await supabase
      .from("paginas_web")
      .select("slug_interno, updated_at")
      .eq("empresa_id", empresaId)
      .eq("estado", "PUBLICADA")
      .neq("id", paginaId);

    for (const p of (paginas ?? []) as Array<{
      slug_interno: string | null;
      updated_at: string | null;
    }>) {
      if (!p.slug_interno) continue;
      urls.push({
        url: `${base}/${p.slug_interno}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "monthly",
        priority: 0.3,
      });
    }

    // Portales: solo los que la empresa tiene de verdad. La carta además exige
    // estar publicada — anunciar a Google una carta despublicada es prometerle
    // una página que devuelve "no encontrada".
    const { data: emp } = await supabase
      .from("empresas")
      .select("carta_slug, carta_publicada, empleo_slug, slug")
      .eq("id", empresaId)
      .maybeSingle();

    if (emp) {
      const e = emp as Record<string, string | boolean | null>;
      for (const portal of PORTALES) {
        if (portal.ruta === "/carta" && !e.carta_publicada) continue;
        if (!e[portal.campo]) continue;
        urls.push({
          url: `${base}${portal.ruta}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: portal.prioridad,
        });
      }
    }

    return urls;
  } catch (err) {
    console.error("[sitemap]", err);
    return PAGINAS_SAAS;
  }
}
