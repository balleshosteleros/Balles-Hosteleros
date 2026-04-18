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

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("paginas_web_dominios")
      .select("hostname, pagina_id")
      .eq("estado", "VERIFICADO");
    if (error) return [];

    const urls: MetadataRoute.Sitemap = [];
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
    return [];
  }
}
