import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/marketing/", "/sala/", "/cocina/", "/direccion/", "/rrhh/", "/ajustes/", "/api/"],
      },
    ],
    sitemap: "/sitemap.xml",
  };
}
