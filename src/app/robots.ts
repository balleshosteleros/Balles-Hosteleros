import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { normalizarHost } from "@/features/marketing/pagina-web/services/hostname-resolver";

/**
 * `robots.txt` por DOMINIO.
 *
 * El sitemap DEBE ir con URL absoluta: es lo que exige el estándar, y una ruta
 * relativa ("/sitemap.xml") muchos rastreadores la ignoran. Al servirse esta
 * ruta desde todos los hosts, hay que componerla con el host que pregunta —si
 * se cablea, el dominio del restaurante acabaría apuntando al sitemap del
 * software.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const cab = await headers();
  const host = normalizarHost(cab.get("x-forwarded-host") ?? cab.get("host") ?? "");
  const base = host ? `https://${host}` : "";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/marketing/", "/sala/", "/cocina/", "/direccion/", "/rrhh/", "/ajustes/", "/api/"],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : "/sitemap.xml",
  };
}
