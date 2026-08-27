/**
 * Sirve las imágenes de Supabase Storage por el endpoint de transformación en
 * vez del original.
 *
 * POR QUÉ:
 * Las fotos migradas desde GoHighLevel pesan ~1 MB cada una y la galería monta
 * 12, así que la portada arrastraba ~9,5 MB. Pidiendo el ancho real que se
 * pinta, la misma foto baja a ~190 KB en WebP (Supabase negocia el formato con
 * la cabecera Accept del navegador). Es un cambio de URL: no hay que resubir ni
 * duplicar ficheros.
 *
 * Solo aplica a URLs públicas de Supabase Storage; cualquier otra se devuelve
 * intacta para no romper imágenes externas.
 */

const PATRON_PUBLICO = "/storage/v1/object/public/";
const PATRON_RENDER = "/storage/v1/render/image/public/";

export interface OpcionesImagen {
  /** Ancho en píxeles del hueco donde se pinta. */
  width: number;
  /** 1-100. 65-75 es indistinguible a simple vista en fotos de comida. */
  quality?: number;
}

export function imagenOptimizada(url: string, opts: OpcionesImagen): string {
  if (!url || !url.includes(PATRON_PUBLICO)) return url;
  // Un SVG no se beneficia del redimensionado y puede romperse al rasterizar.
  if (/\.svg(\?|$)/i.test(url)) return url;

  const base = url.replace(PATRON_PUBLICO, PATRON_RENDER);
  const sep = base.includes("?") ? "&" : "?";
  const q = Math.min(100, Math.max(20, opts.quality ?? 70));
  return `${base}${sep}width=${Math.round(opts.width)}&quality=${q}`;
}

/**
 * `srcset` para que cada dispositivo baje solo lo que necesita: el móvil no
 * tiene por qué descargar la versión de escritorio.
 */
export function srcSetOptimizado(url: string, anchos: number[], quality = 70): string | undefined {
  if (!url || !url.includes(PATRON_PUBLICO)) return undefined;
  if (/\.svg(\?|$)/i.test(url)) return undefined;
  return anchos
    .map((w) => `${imagenOptimizada(url, { width: w, quality })} ${w}w`)
    .join(", ");
}
