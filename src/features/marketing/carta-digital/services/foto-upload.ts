/**
 * Subida de fotos al bucket carta-fotos (cliente browser).
 * Comprime con canvas antes de enviar para evitar pesos > 1 MB.
 */
import { createClient } from "@/lib/supabase/client";

const MAX_LADO = 1280;
const QUALITY = 0.82;

export async function comprimirImagen(file: File): Promise<Blob> {
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

export type SubidaFotoResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

export async function subirFotoItem(
  file: File,
  empresaId: string,
  itemId: string,
): Promise<SubidaFotoResult> {
  try {
    const supabase = createClient();
    const blob = await comprimirImagen(file);
    const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop() ?? "jpg";
    const path = `${empresaId}/${itemId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("carta-fotos")
      .upload(path, blob, { upsert: false, contentType: blob.type });
    if (error) {
      console.error("[foto-upload]", error.message);
      return { ok: false, error: error.message };
    }
    const { data } = supabase.storage.from("carta-fotos").getPublicUrl(path);
    return { ok: true, url: data.publicUrl, path };
  } catch (err) {
    console.error("[foto-upload] fatal:", err);
    return { ok: false, error: (err as Error).message };
  }
}
