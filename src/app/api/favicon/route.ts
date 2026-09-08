/**
 * Favicon REDONDO de cualquier empresa.
 *
 * El navegador dibuja el favicon tal cual, así que el recorte circular hay que
 * hacerlo aquí: esta ruta coge el isotipo de la empresa y devuelve el PNG ya
 * redondo (ver `icono-circular.ts` para el porqué y los dos casos que trata).
 *
 * Se hace al vuelo en vez de guardar una copia recortada en el storage para que
 * valga para toda empresa presente y futura sin ningún paso manual: quien sube
 * un isotipo nuevo en Ajustes → Imagen de marca lo ve redondo en la pestaña sin
 * que nadie regenere nada.
 */
import { NextResponse } from "next/server";
import { iconoCircular } from "@/shared/lib/icono-circular";

export const runtime = "nodejs";

/** Un mes. El nombre del archivo de origen lleva marca de tiempo: al cambiar el
 *  isotipo cambia la URL, así que cachear largo no deja iconos viejos pegados. */
const CACHE = "public, max-age=2592000, stale-while-revalidate=86400";

/**
 * Solo se recortan imágenes NUESTRAS. Sin esta lista, el parámetro `u` haría
 * que el servidor descargara cualquier dirección que le pasen en nuestro nombre.
 */
function origenPermitido(url: URL): boolean {
  const permitidos = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.R2_PUBLIC_URL]
    .map((v) => {
      try {
        return v ? new URL(v).host : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return url.protocol === "https:" && permitidos.includes(url.host);
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const origen = params.get("u");
  if (!origen) return NextResponse.json({ error: "falta la imagen" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(origen);
  } catch {
    return NextResponse.json({ error: "imagen no válida" }, { status: 400 });
  }
  if (!origenPermitido(url)) {
    return NextResponse.json({ error: "imagen no válida" }, { status: 400 });
  }

  const png = await iconoCircular(url.toString(), params.get("c"));

  // Si no se ha podido recortar, la pestaña se queda con el icono de siempre en
  // vez de con un hueco: un fallo del recorte no puede dejar la web sin favicon.
  if (!png) return NextResponse.redirect(url.toString(), 302);

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": CACHE },
  });
}
