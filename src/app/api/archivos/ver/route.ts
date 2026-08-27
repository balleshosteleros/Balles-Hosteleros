import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { presignGetR2, getObjectR2 } from "@/shared/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PRP-079 — Servir un archivo de la galería (foto o vídeo).
 *
 * Dos modos:
 *  · Por defecto: redirige a una URL GET firmada de R2. El archivo se sirve
 *    directo desde R2, sin gastar tiempo de función mientras se ve un vídeo, y
 *    conservando el soporte nativo de saltar a un punto (Range requests).
 *  · `?descargar=1`: proxy same-origin con `Content-Disposition: attachment`.
 *    Hace falta porque el navegador IGNORA el atributo `download` de un enlace
 *    cross-origin, y el vídeo se abriría en la pestaña en vez de bajarse.
 *
 * `?thumb=1` sirve la miniatura en vez del original.
 *
 * Comprueba SIEMPRE que el usuario ve el departamento del archivo: la RLS aísla
 * la empresa, pero no el departamento.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const quiereThumb = url.searchParams.get("thumb") === "1";
    const quiereDescarga = url.searchParams.get("descargar") === "1";
    if (!id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) {
      return NextResponse.json({ error: "Sin empresa activa" }, { status: 403 });
    }

    const { data: archivo } = await supabase
      .from("documentos")
      .select("nombre, departamento, r2_key, miniatura_key")
      .eq("empresa_id", empresaId)
      .eq("id", id)
      .maybeSingle();

    if (!archivo?.r2_key) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    // El departamento manda: si el rol no lo ve, el archivo no existe para él.
    // `bh_departamentos_usuario` devuelve ya las claves canónicas.
    const { data: deps } = await supabase.rpc("bh_departamentos_usuario", {
      p_empresa: empresaId,
    });
    const normalizar = (v: string) =>
      v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
    const visibles = (Array.isArray(deps) ? (deps as string[]) : []).map(normalizar);
    if (!visibles.includes(normalizar((archivo.departamento as string) ?? ""))) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }

    const key =
      quiereThumb && archivo.miniatura_key
        ? (archivo.miniatura_key as string)
        : (archivo.r2_key as string);

    if (!quiereDescarga) {
      return NextResponse.redirect(presignGetR2(key));
    }

    const { body, contentType, contentLength } = await getObjectR2(key);
    const nombre =
      ((archivo.nombre as string) || "archivo").replace(/[^\w\s.-]/g, "_").trim() ||
      "archivo";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    );
    if (contentLength != null) headers.set("Content-Length", String(contentLength));
    headers.set("Cache-Control", "private, no-store");

    return new Response(body, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al servir el archivo";
    console.error("[archivos ver] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
