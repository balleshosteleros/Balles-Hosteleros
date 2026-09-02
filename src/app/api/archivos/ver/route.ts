import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { presignGetR2, getObjectR2 } from "@/shared/lib/r2";
import {
  generarMiniaturaEnServidor,
  puedeGenerarMiniatura,
} from "@/features/archivos/lib/miniaturas-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Genera la miniatura que falta y la deja apuntada en la base de datos.
 *
 * La clave sigue la MISMA convención que al subir desde el navegador
 * (`<base>_thumb.jpg`), para que no haya dos formas de nombrar lo mismo.
 *
 * Devuelve el JPEG ya generado, o null si no se pudo: en ese caso la galería
 * cae al icono del tipo de archivo, que es el comportamiento de siempre.
 */
async function generarMiniaturaMiniaturaKey(
  supabase: SupabaseClient,
  archivoId: string,
  r2Key: string,
): Promise<Buffer | null> {
  const miniaturaKey = `${r2Key.replace(/\.[^./]+$/, "")}_thumb.jpg`;

  const miniatura = await generarMiniaturaEnServidor(r2Key, miniaturaKey);
  if (!miniatura) return null;

  // Se apunta DESPUÉS de subirla: si la escritura en base de datos fallara,
  // la siguiente visita simplemente la vuelve a generar. Al revés dejaría una
  // clave apuntando a un objeto que no existe, y la foto saldría rota.
  await supabase
    .from("documentos")
    .update({ miniatura_key: miniaturaKey })
    .eq("id", archivoId);

  return miniatura;
}

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
      .select("nombre, departamento, r2_key, miniatura_key, tipo_mime, tamano_bytes")
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

    /*
     * Miniatura que aún no existe: se genera AHORA y se guarda.
     *
     * Los 4.231 archivos importados de Drive no tienen miniatura —se copiaron
     * de servidor a servidor, sin pasar por el navegador—, así que la
     * cuadrícula era un muro de cuadrados grises. La primera vez que se pide
     * la de una foto se crea aquí; a partir de entonces `miniatura_key` ya
     * está puesta y se sirve como cualquier otra.
     */
    if (
      quiereThumb &&
      !archivo.miniatura_key &&
      puedeGenerarMiniatura(
        (archivo.tipo_mime as string) ?? "",
        (archivo.tamano_bytes as number) ?? 0,
      )
    ) {
      // Si generar la miniatura peta (p. ej. `sharp` no carga en el servidor),
      // NO debe caerse la ruta: sin esto, un fallo del generador dejaba el
      // archivo sin poder abrirse ni descargarse.
      const generada = await generarMiniaturaMiniaturaKey(
        supabase,
        id,
        archivo.r2_key as string,
      ).catch((err) => {
        console.error("[archivos ver] miniatura:", err);
        return null;
      });
      if (generada) {
        return new Response(new Uint8Array(generada), {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            // Privada: la miniatura enseña el contenido de un archivo que solo
            // ve quien tiene permiso sobre ese departamento.
            "Cache-Control": "private, max-age=86400",
          },
        });
      }
      // Si no se pudo generar, se sigue: el original sirve de vista previa.
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
