/**
 * PRP-088 — Sirve una página CLONADA tal cual.
 *
 * Por qué una ruta aparte y no la página normal del sitio público: la copia es
 * un documento completo con su propio CSS, y el sitio público carga los estilos
 * globales de la app (el reset de Tailwind). Metida ahí dentro, la copia dejaría
 * de ser idéntica —que es justo lo único que se le pide—. Aquí se devuelve el
 * documento entero, sin envolverlo en nada.
 *
 * Se llega por el rewrite que genera `replicasComoRutas()` en next.config.ts:
 * el visitante ve la dirección normal (dominio del cliente + su ruta).
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAnonClient } from "@/lib/supabase/anon";
import { registrarVisita } from "@/features/marketing/pagina-web/services/visitas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paginaId: string }> },
) {
  const { paginaId } = await params;

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("paginas_web")
    .select("html_replica")
    .eq("id", paginaId)
    .eq("estado", "PUBLICADA")
    .maybeSingle();

  const html = (data as { html_replica?: string | null } | null)?.html_replica;
  if (error || !html) {
    return new NextResponse("Página no encontrada", { status: 404 });
  }

  // Misma estadística que las páginas de bloques: sin `await`, el visitante no
  // espera a que se apunte la visita.
  const cabeceras = await headers();
  void registrarVisita(paginaId, cabeceras.get("user-agent"));

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Corto: la copia se rehace al volver a clonar, y así un cambio se ve sin
      // esperar a que caduque una caché larga.
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
