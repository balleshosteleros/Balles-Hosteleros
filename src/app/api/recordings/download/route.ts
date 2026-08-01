import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getObjectR2 } from "@/shared/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy de descarga same-origin para grabaciones.
 *
 * El vídeo vive en R2 (otro origen). El atributo `download` de un <a> es
 * IGNORADO por el navegador en enlaces cross-origin, así que el vídeo se abría
 * en la pestaña en vez de descargarse. Aquí lo servimos desde el propio dominio
 * con `Content-Disposition: attachment`, forzando la descarga al ordenador.
 *
 * Respeta RLS: usa el cliente de servidor con la sesión del usuario, de modo que
 * solo se pueden descargar grabaciones que el usuario puede ver (su empresa /
 * sus departamentos).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // RLS filtra: solo devuelve la fila si el usuario tiene acceso a ella.
    const { data: rec, error } = await supabase
      .from("recordings")
      .select("title, r2_key, url")
      .eq("id", id)
      .single();

    if (error || !rec) {
      return NextResponse.json({ error: "Grabación no encontrada" }, { status: 404 });
    }

    const key = rec.r2_key || rec.url?.split("/").slice(3).join("/") || "";
    if (!key) {
      return NextResponse.json({ error: "Objeto sin clave" }, { status: 404 });
    }

    const { body, contentType, contentLength } = await getObjectR2(key);

    const ext = key.split(".").pop()?.toLowerCase() || "webm";
    const safeTitle = (rec.title || "grabacion").replace(/[^\w\s.-]/g, "_").trim() || "grabacion";
    const filename = `${safeTitle}.${ext}`;

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    if (contentLength != null) headers.set("Content-Length", String(contentLength));
    headers.set("Cache-Control", "private, no-store");

    return new Response(body, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al descargar";
    console.error("[recordings download] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
