/* Utilidades de subida de fotos para estudios_apertura.
   El bucket admite hasta 10 MB; el body de la action acepta el equivalente
   en base64 (~14 MB) según next.config.ts. Para no enviar archivos enormes,
   comprimimos en cliente antes de subir (resize a 2000 px máx + JPEG q=0.85).
   Las fotos de móvil de 8-12 MB acaban en 800 KB-1.5 MB, sin pérdida visual
   perceptible. */
export const MAX_FOTO_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;
const SKIP_COMPRESSION_BELOW = 800 * 1024;
/* Formatos que el navegador no puede comprimir sin perder algo importante:
   HEIC (Chrome no decodifica) y GIF (perderíamos la animación). Pasan
   tal cual y el servidor decide. */
const NON_COMPRESSIBLE = new Set(["image/heic", "image/heif", "image/gif"]);

export function leerComoDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

async function comprimirImagen(file: File): Promise<File> {
  if (NON_COMPRESSIBLE.has(file.type)) return file;
  if (file.size <= SKIP_COMPRESSION_BELOW) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const nuevoNombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nuevoNombre, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

/* Pipeline completo: valida tipo → comprime → valida tamaño final → lee
   como data URL. Devuelve los 3 valores que la action necesita. */
export async function prepararFotoParaSubida(file: File): Promise<
  | { ok: true; dataUrl: string; tipo: string; tamano: number }
  | { ok: false; error: string }
> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "El archivo no es una imagen" };
  }
  let final = file;
  try {
    final = await comprimirImagen(file);
  } catch (err) {
    console.warn("[foto-upload] compresión falló, usando original:", err);
  }
  if (final.size > MAX_FOTO_BYTES) {
    return {
      ok: false,
      error: `Imagen demasiado grande. Máximo ${MAX_FOTO_BYTES / 1024 / 1024} MB.`,
    };
  }
  const dataUrl = await leerComoDataUrl(final);
  return { ok: true, dataUrl, tipo: final.type, tamano: final.size };
}
