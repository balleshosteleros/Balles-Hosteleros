/**
 * PRP-079 — Miniaturas y dimensiones, calculadas EN EL NAVEGADOR.
 *
 * Se hace en el cliente a propósito: procesar vídeo en el servidor exigiría
 * ffmpeg y tiempo de función por cada archivo, y la subida va directa a R2 sin
 * pasar por el servidor. Aquí se resuelve con `canvas`, sin dependencias.
 *
 * Si algo falla, se devuelve null: la galería funciona igual sin miniatura.
 */

/** Lado mayor de la miniatura, en píxeles. Suficiente para la cuadrícula. */
const LADO_MINIATURA = 400;

/** Calidad JPEG de la miniatura. */
const CALIDAD = 0.75;

/** Tope de espera al decodificar: un códec raro dejaría la cola colgada. */
const TIMEOUT_MS = 10_000;

type Dimensiones = {
  ancho: number;
  alto: number;
  duracionSeg: number | null;
};

/** Escala manteniendo la proporción, sin agrandar si ya es pequeña. */
function escalar(ancho: number, alto: number) {
  const factor = Math.min(1, LADO_MINIATURA / Math.max(ancho, alto));
  return { w: Math.round(ancho * factor), h: Math.round(alto * factor) };
}

function aBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", CALIDAD));
}

/** Miniatura de una imagen. */
async function miniaturaImagen(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const { w, h } = escalar(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await aBlob(canvas);
  } finally {
    bitmap.close();
  }
}

/**
 * Miniatura de un vídeo: primer fotograma con contenido.
 *
 * Se salta a 0,1 s en vez de 0: el fotograma inicial de muchos vídeos de móvil
 * es negro y daría una miniatura en blanco.
 */
function miniaturaVideo(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let resuelto = false;

    const terminar = (blob: Blob | null) => {
      if (resuelto) return;
      resuelto = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.1, video.duration || 0);
    };

    video.onseeked = async () => {
      try {
        const { w, h } = escalar(video.videoWidth, video.videoHeight);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return terminar(null);
        ctx.drawImage(video, 0, 0, w, h);
        terminar(await aBlob(canvas));
      } catch {
        terminar(null);
      }
    };

    video.onerror = () => terminar(null);
    setTimeout(() => terminar(null), TIMEOUT_MS);
  });
}

/** Miniatura del archivo, sea foto o vídeo. Null si no se puede generar. */
export async function generarMiniatura(file: File): Promise<Blob | null> {
  if (file.type.startsWith("image/")) return miniaturaImagen(file);
  if (file.type.startsWith("video/")) return miniaturaVideo(file);
  return null;
}

/** Ancho, alto y (en vídeos) duración. Null si no se pueden leer. */
export function leerDimensiones(file: File): Promise<Dimensiones | null> {
  if (file.type.startsWith("image/")) {
    return createImageBitmap(file)
      .then((b) => {
        const d = { ancho: b.width, alto: b.height, duracionSeg: null };
        b.close();
        return d;
      })
      .catch(() => null);
  }

  if (!file.type.startsWith("video/")) return Promise.resolve(null);

  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let resuelto = false;

    const terminar = (d: Dimensiones | null) => {
      if (resuelto) return;
      resuelto = true;
      URL.revokeObjectURL(url);
      resolve(d);
    };

    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () =>
      terminar({
        ancho: video.videoWidth,
        alto: video.videoHeight,
        duracionSeg: Number.isFinite(video.duration)
          ? Math.round(video.duration)
          : null,
      });
    video.onerror = () => terminar(null);
    setTimeout(() => terminar(null), TIMEOUT_MS);
  });
}
