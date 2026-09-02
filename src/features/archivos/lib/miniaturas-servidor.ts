/**
 * PRP-079 — Miniaturas generadas EN EL SERVIDOR, bajo demanda.
 *
 * Las miniaturas normales se calculan en el navegador al subir el archivo
 * (`miniaturas.ts`). Pero los 4.231 archivos que se trajeron de Google Drive
 * no pasaron por ese camino: se copiaron de servidor a servidor, así que
 * NINGUNO tiene miniatura y en la cuadrícula salían todos como cuadrados
 * grises, imposibles de distinguir sin abrirlos uno a uno (Iván, 01-sep-2026).
 *
 * Este módulo las genera a posteriori: la primera vez que se pide la miniatura
 * de una foto que no la tiene, se crea aquí y se GUARDA en R2. A partir de
 * entonces se sirve como cualquier otra, sin volver a procesar nada.
 *
 * Medido con fotos reales del Drive de la empresa (~5 MB, 12-24 Mpx):
 * unos 370 ms de proceso y 17 KB por miniatura. Las 3.864 fotos ocupan 64 MB
 * sobre los 183 GB ya guardados: un 0,03 % más.
 *
 * Solo fotos. Sacar un fotograma de un vídeo exigiría ffmpeg —un binario
 * pesado, con su tiempo de función por archivo—, y no compensa: los vídeos ya
 * se distinguen por su icono y su duración.
 *
 * SOLO servidor: usa `sharp`, un binario nativo. Debe usarse únicamente
 * desde rutas con runtime "nodejs", nunca desde un componente de cliente.
 */

import { getObjectBufferR2, putObjectR2 } from "@/shared/lib/r2";

/** Mismo lado que las miniaturas del navegador: la cuadrícula es idéntica. */
const LADO_MINIATURA = 400;

/** Misma calidad JPEG que en el navegador. */
const CALIDAD = 75;

/**
 * Tope de seguridad del original.
 *
 * Un archivo enorme se leería ENTERO en memoria y podría tumbar la función.
 * Por encima de esto no se genera miniatura: la foto se sigue viendo al
 * abrirla, simplemente en la cuadrícula sale su icono.
 */
const MAX_ORIGINAL_BYTES = 60 * 1024 * 1024;

/**
 * Formatos que `sharp` NO sabe decodificar y que no tiene sentido intentar.
 *
 * El RAW de cámara es el archivo en bruto del sensor: hacen falta las curvas
 * del fabricante para revelarlo. HEIC/HEIF depende de que libvips venga
 * compilado con soporte, cosa que no está garantizada en el servidor; se
 * intenta igualmente y, si falla, se resuelve como null sin romper nada.
 */
const NO_DECODIFICABLES = new Set([
  "image/arw",
  "image/cr2",
  "image/cr3",
  "image/nef",
  "image/dng",
  "image/raf",
  "image/orf",
  "image/rw2",
  "image/x-adobe-dng",
]);

/** ¿Tiene sentido intentar generar la miniatura de este archivo? */
export function puedeGenerarMiniatura(mime: string, tamanoBytes: number): boolean {
  if (!mime.startsWith("image/")) return false;
  if (NO_DECODIFICABLES.has(mime.toLowerCase())) return false;
  return tamanoBytes <= MAX_ORIGINAL_BYTES;
}

/**
 * Genera la miniatura de una foto ya subida y la guarda en R2.
 *
 * Devuelve el JPEG para poder servirlo en la misma petición que lo pidió, sin
 * un segundo viaje a R2. Null si no se pudo generar: quien llama debe seguir
 * funcionando sin miniatura, nunca fallar por esto.
 */
export async function generarMiniaturaEnServidor(
  r2KeyOriginal: string,
  miniaturaKey: string,
): Promise<Buffer | null> {
  try {
    // `sharp` se carga AQUÍ, no arriba del fichero.
    //
    // Es un binario nativo y en el servidor de producción no llega a cargar
    // ("Could not load the sharp module... libvips-cpp.so"). Con el import
    // estático ese fallo tumbaba la ruta ENTERA de servir archivos: un Excel
    // no se podía ni abrir ni descargar, aunque no tenga nada que ver con
    // generar miniaturas. Cargándolo solo cuando de verdad se va a redimensionar,
    // el fallo se queda dentro de este `catch`: la miniatura no sale, y todo
    // lo demás sigue funcionando.
    const { default: sharp } = await import("sharp");

    const original = await getObjectBufferR2(r2KeyOriginal);

    const miniatura = await sharp(original)
      // `inside` mantiene la proporción y no recorta; `withoutEnlargement`
      // evita agrandar una foto que ya fuera más pequeña que 400px.
      .resize(LADO_MINIATURA, LADO_MINIATURA, {
        fit: "inside",
        withoutEnlargement: true,
      })
      // Sin esto, una foto de móvil tumbada sale girada: la orientación va en
      // los metadatos EXIF y se pierde al reescalar.
      .rotate()
      .jpeg({ quality: CALIDAD })
      .toBuffer();

    await putObjectR2(miniaturaKey, miniatura, "image/jpeg");
    return miniatura;
  } catch (err) {
    // Un formato que libvips no entienda, un original corrupto o un fallo de
    // red no deben romper la galería: se cae al icono del tipo de archivo.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[miniaturas] No se pudo generar ${miniaturaKey}: ${msg}`);
    return null;
  }
}
