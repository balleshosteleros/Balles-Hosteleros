import "server-only";

import { META_GRAPH_BASE, traducirErrorMeta, MetaApiError } from "@/features/marketing/meta-ads/lib/meta-api";
import { metaGet, metaPost } from "@/features/marketing/meta-ads/services/meta-client";
import type { MetaCredenciales } from "@/features/marketing/meta-ads/services/meta-credenciales";

/**
 * PRP-087 · Fase 6 — Imagen, vídeo y carrusel.
 *
 * Meta no admite poner la URL de una foto en el anuncio y ya: hay que subirle
 * el archivo y quedarse con lo que devuelve —un `image_hash` para las fotos y
 * un `video_id` para los vídeos—, que es lo que de verdad se usa al crear la
 * creatividad.
 *
 * Las fotos van por bytes (pesan poco). Los vídeos NO: se le pasa a Meta la
 * dirección desde la que descargarlo, para no mover cientos de megas a través
 * de nuestro servidor.
 */

/** Formatos que Meta acepta y que tienen sentido para un restaurante. */
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;
export const TIPOS_VIDEO = ["video/mp4", "video/quicktime"] as const;

/** Meta rechaza fotos de más de 8 MB. Mejor decirlo antes de subir. */
export const MAX_IMAGEN_BYTES = 8 * 1024 * 1024;

interface RespuestaImagenes {
  images?: Record<string, { hash?: string; url?: string }>;
}

/**
 * Sube una foto a la biblioteca de la cuenta publicitaria y devuelve su hash.
 *
 * Va por multipart, que es lo único que acepta `adimages` para bytes, así que
 * no puede usar el `metaPost` normal (ese manda formulario codificado).
 */
export async function subirImagenAMeta(
  cred: MetaCredenciales,
  archivo: Blob,
  nombre: string,
): Promise<{ imageHash: string; url: string | null }> {
  if (archivo.size > MAX_IMAGEN_BYTES) {
    throw new MetaApiError("La imagen pesa más de 8 MB, que es el máximo que admite Meta.");
  }

  const cuerpo = new FormData();
  cuerpo.append("access_token", cred.accessToken);
  cuerpo.append(nombre, archivo, nombre);

  const res = await fetch(`${META_GRAPH_BASE}/${cred.adAccountId}/adimages`, {
    method: "POST",
    body: cuerpo,
    cache: "no-store",
  });

  const datos: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw traducirErrorMeta(datos, res.status);

  // Meta devuelve las imágenes indexadas por el nombre del archivo.
  const imagenes = (datos as RespuestaImagenes).images ?? {};
  const primera = Object.values(imagenes)[0];
  if (!primera?.hash) {
    throw new MetaApiError("Meta ha aceptado la imagen pero no ha devuelto su identificador.");
  }

  return { imageHash: primera.hash, url: primera.url ?? null };
}

/**
 * Manda a Meta un vídeo indicándole de dónde descargarlo.
 *
 * `file_url` tiene que ser una dirección a la que Meta pueda entrar por su
 * cuenta desde internet: una URL firmada de R2 sirve, siempre que no caduque
 * antes de que Meta termine de descargarlo.
 */
export async function subirVideoAMeta(
  cred: MetaCredenciales,
  urlDescarga: string,
  titulo: string,
): Promise<{ videoId: string }> {
  const res = await metaPost<{ id?: string }>(
    `/${cred.adAccountId}/advideos`,
    cred.accessToken,
    { file_url: urlDescarga, title: titulo, name: titulo },
  );
  if (!res.id) throw new MetaApiError("Meta no ha devuelto el identificador del vídeo.");
  return { videoId: res.id };
}

export type EstadoVideo = "procesando" | "listo" | "error";

interface RespuestaEstadoVideo {
  status?: { video_status?: string; processing_progress?: number; error?: { message?: string } };
  picture?: string;
}

/**
 * En qué punto está el procesado de un vídeo.
 *
 * Un vídeo recién subido NO se puede usar todavía: Meta tarda desde segundos
 * hasta varios minutos en dejarlo listo, y si se crea el anuncio antes de
 * tiempo, lo rechaza. Por eso hay que preguntar hasta que diga que está listo.
 */
export async function getEstadoVideo(
  cred: MetaCredenciales,
  videoId: string,
): Promise<{ estado: EstadoVideo; progreso: number; miniatura: string | null; error: string | null }> {
  const res = await metaGet<RespuestaEstadoVideo>(`/${videoId}`, cred.accessToken, {
    fields: "status,picture",
  });

  const bruto = res.status?.video_status?.toLowerCase() ?? "";
  const estado: EstadoVideo =
    bruto === "ready" ? "listo" : bruto === "error" ? "error" : "procesando";

  return {
    estado,
    progreso: res.status?.processing_progress ?? 0,
    miniatura: res.picture ?? null,
    error: res.status?.error?.message ?? null,
  };
}

/**
 * Miniatura de un vídeo, subida como imagen para poder usarla en el anuncio.
 *
 * Meta exige una miniatura al crear una creatividad de vídeo. La que genera él
 * mismo viene como URL, y hay que devolvérsela convertida en `image_hash`.
 */
export async function subirMiniaturaDeVideo(
  cred: MetaCredenciales,
  urlMiniatura: string,
  nombre: string,
): Promise<string | null> {
  try {
    const descarga = await fetch(urlMiniatura, { cache: "no-store" });
    if (!descarga.ok) return null;
    const blob = await descarga.blob();
    const { imageHash } = await subirImagenAMeta(cred, blob, `${nombre}-miniatura.jpg`);
    return imageHash;
  } catch (err) {
    // Sin miniatura el anuncio de vídeo puede seguir adelante en muchos casos;
    // no merece la pena tumbar la publicación por esto.
    console.error("[meta] no se pudo subir la miniatura del vídeo:", err);
    return null;
  }
}
