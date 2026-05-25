/**
 * Subida de imágenes al bucket `inspeccion-imagenes` (cliente).
 * Comprime con canvas antes de enviar para evitar pesos > 1 MB.
 * Patrón path: {empresaId}/{kind}/{uid}-{ts}.webp
 */
import { createClient } from "@/lib/supabase/client";

const MAX_LADO = 1600;
const QUALITY = 0.85;
const BUCKET = "inspeccion-imagenes";

async function comprimir(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : (() => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        })();
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  (ctx as CanvasRenderingContext2D).drawImage(bitmap, 0, 0, w, h);
  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: "image/webp", quality: QUALITY });
  }
  return await new Promise<Blob>((resolve) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => resolve(b ?? file),
      "image/webp",
      QUALITY,
    );
  });
}

export type SubidaImagenResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

export async function subirImagenInspeccion(
  file: File,
  empresaId: string,
  kind: "slide" | "card" | "image-block" = "slide",
): Promise<SubidaImagenResult> {
  try {
    const supabase = createClient();
    const blob = await comprimir(file);
    const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop() ?? "jpg";
    const uid = Math.random().toString(36).slice(2, 10);
    const path = `${empresaId}/${kind}/${uid}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: false, contentType: blob.type });
    if (error) {
      console.error("[inspeccion-imagenes]", error.message);
      return { ok: false, error: error.message };
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl, path };
  } catch (err) {
    console.error("[inspeccion-imagenes] fatal:", err);
    return { ok: false, error: (err as Error).message };
  }
}
