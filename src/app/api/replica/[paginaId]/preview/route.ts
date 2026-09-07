/**
 * PRP-088 — Vista previa de una página CLONADA, antes de publicarla.
 *
 * Igual que la ruta pública, devuelve el documento entero y sin envolver: la
 * copia trae su propio CSS y meterla dentro de la app la cambiaría.
 *
 * Diferencia con la pública: aquí se sirve aunque esté en BORRADOR, así que
 * exige sesión y que la página sea de la empresa activa. Es material interno.
 */
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paginaId: string }> },
) {
  const { paginaId } = await params;

  const { userId, empresaId } = await getAppContext();
  if (!userId || !empresaId) {
    return new NextResponse("Hay que iniciar sesión", { status: 401 });
  }

  // Con cliente de servicio pero filtrando por la empresa activa: nadie ve el
  // borrador de otra empresa cambiando el identificador de la dirección.
  const admin = createAdminClient();
  const { data } = await admin
    .from("paginas_web")
    .select("html_replica")
    .eq("id", paginaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const html = (data as { html_replica?: string | null } | null)?.html_replica;
  if (!html) return new NextResponse("Esta página no es una copia", { status: 404 });

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Una vista previa nunca se cachea: se mira justo después de tocarla.
      "cache-control": "no-store",
    },
  });
}
