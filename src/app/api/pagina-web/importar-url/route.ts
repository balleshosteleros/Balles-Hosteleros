/**
 * POST /api/pagina-web/importar-url
 * Body: { paginaId: uuid, url: string }
 * Fetch server-side del HTML, importa a bloques y los guarda en la página (BORRADOR).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { importarDesdeHtml } from "@/features/marketing/pagina-web/services/importador-html";
import { bloquesArraySchema } from "@/features/marketing/pagina-web/services/bloque-schemas";
import { sanitizarBloqueTextoLibre } from "@/features/marketing/pagina-web/services/sanitize-html";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  paginaId: z.string().uuid(),
  url: z.string().url(),
});

export async function POST(req: NextRequest) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) {
      return NextResponse.json({ ok: false, error: "Sin empresa" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }

    // Verificar propiedad de la página
    const { data: pag } = await supabase
      .from("paginas_web")
      .select("id, empresa_id")
      .eq("id", parsed.data.paginaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!pag) {
      return NextResponse.json(
        { ok: false, error: "Página no encontrada" },
        { status: 404 },
      );
    }

    // Fetch del HTML
    const htmlRes = await fetch(parsed.data.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BallesHosteleros-Importer/1.0; +https://balleshosteleros.com)",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!htmlRes.ok) {
      return NextResponse.json(
        { ok: false, error: `No se pudo acceder a la URL (HTTP ${htmlRes.status})` },
        { status: 400 },
      );
    }
    const html = await htmlRes.text();

    // Importar → bloques + sanitizar texto_libre + validar
    const resultado = importarDesdeHtml(html, parsed.data.url);
    const sanitizados = resultado.bloques.map((b) => sanitizarBloqueTextoLibre(b));
    const validado = bloquesArraySchema.safeParse(sanitizados);
    if (!validado.success) {
      console.error("[importar-url] validación:", validado.error.issues);
      return NextResponse.json(
        { ok: false, error: "Bloques inválidos tras importar" },
        { status: 500 },
      );
    }

    // Guardar en la página
    const { error: upErr } = await supabase
      .from("paginas_web")
      .update({ bloques: validado.data })
      .eq("id", parsed.data.paginaId)
      .eq("empresa_id", empresaId);
    if (upErr) {
      console.error("[importar-url] update:", upErr.message);
      return NextResponse.json(
        { ok: false, error: "No se pudo guardar" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      bloques: validado.data.length,
      stats: resultado.stats,
    });
  } catch (err) {
    console.error("[importar-url] fatal:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
