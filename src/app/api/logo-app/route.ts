import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Logo de una app externa, servido POR NOSOTROS.
 *
 * Antes el `<img>` del lanzador apuntaba directo al servicio de favicons de
 * Google, así que el navegador de cada empleado hacía una petición a un tercero
 * (y le contaba qué aplicaciones usa la empresa). Aquí el servidor busca el
 * icono una vez y lo devuelve él mismo; el navegador solo habla con nosotros.
 *
 * Las marcas habituales ni pasan por aquí: van en `public/logos-apps`. Esta
 * ruta es el comodín para una app nueva cuyo logo todavía no tenemos.
 */
const CACHE = "public, max-age=86400, stale-while-revalidate=604800";

export async function GET(req: Request) {
  const dominio = new URL(req.url).searchParams.get("dominio")?.trim().toLowerCase();

  // Solo un host: ni rutas, ni puertos, ni credenciales. Evita que el parámetro
  // se use para que el servidor pida una URL arbitraria en nuestro nombre.
  if (!dominio || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio)) {
    return NextResponse.json({ error: "dominio no válido" }, { status: 400 });
  }

  try {
    const r = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=128`,
      { redirect: "follow", signal: AbortSignal.timeout(8000) },
    );
    const tipo = r.headers.get("content-type") ?? "";
    if (!r.ok || !tipo.startsWith("image/")) {
      return NextResponse.json({ error: "sin logo" }, { status: 404 });
    }
    return new NextResponse(await r.arrayBuffer(), {
      headers: { "Content-Type": tipo, "Cache-Control": CACHE },
    });
  } catch {
    return NextResponse.json({ error: "sin logo" }, { status: 404 });
  }
}
