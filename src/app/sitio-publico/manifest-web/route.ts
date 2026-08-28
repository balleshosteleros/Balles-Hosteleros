/**
 * Manifest PWA POR EMPRESA para las páginas web públicas.
 *
 * POR QUÉ NO VALE `src/app/manifest.ts`:
 * Ese es el de la app de empleados (Mi Panel) y es único para todo el proyecto.
 * Aquí cada dominio es una empresa distinta, así que el nombre y el icono se
 * resuelven en runtime desde el hostname de la petición: guardar la web en la
 * pantalla de inicio deja el LOGO DE LA EMPRESA, no el del software (que es lo
 * que pasa hoy en GoHighLevel, donde sale un icono genérico).
 *
 * Se sirve como route handler y no como `manifest.ts` porque el contenido
 * depende del host y `manifest.ts` se resuelve estáticamente en build.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolverHostname } from "@/features/marketing/pagina-web/services/hostname-resolver";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("x-paginas-web-host") ?? h.get("host") ?? "";

  const match = await resolverHostname(host, "");
  if (!match) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Icono de la PWA: el isotipo (ver comentario en la página).
  const logo = match.isotipo_url;

  const nombre = match.nombre_empresa;

  // `purpose: "any maskable"` en el mismo icono: Android lo recorta a su forma
  // sin dejar el marco blanco que sale cuando no se declara maskable.
  const icons = logo
    ? [
        { src: logo, sizes: "192x192", type: "image/png", purpose: "any" as const },
        { src: logo, sizes: "512x512", type: "image/png", purpose: "any" as const },
        { src: logo, sizes: "512x512", type: "image/png", purpose: "maskable" as const },
      ]
    : [];

  return NextResponse.json(
    {
      name: nombre,
      short_name: nombre,
      description: match.seo?.description ?? `${nombre} · Fuenlabrada`,
      start_url: "/",
      id: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#000000",
      theme_color: "#000000",
      lang: "es-ES",
      icons,
    },
    {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        // Se cachea en el CDN: el manifest cambia solo si cambia el logo.
        "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
