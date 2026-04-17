"use client";

/**
 * Subida de imágenes al bucket paginas-web-assets (cliente browser).
 * Comprime con browser-image-compression antes de enviar.
 */
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

const COMPRESSION_OPTS = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

export type SubidaAssetResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string };

export async function subirAsset(
  file: File,
  empresaId: string,
  paginaId: string,
): Promise<SubidaAssetResult> {
  try {
    if (!file.type.startsWith("image/")) {
      return { ok: false, error: "Solo se admiten imágenes." };
    }
    const supabase = createClient();
    const comprimido =
      file.size > 200_000 ? await imageCompression(file, COMPRESSION_OPTS) : file;
    const ext =
      comprimido.type === "image/webp"
        ? "webp"
        : (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${empresaId}/${paginaId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("paginas-web-assets")
      .upload(path, comprimido, { upsert: false, contentType: comprimido.type });

    if (error) {
      console.error("[pagina-web][asset-upload]", error.message);
      return { ok: false, error: error.message };
    }
    const { data } = supabase.storage.from("paginas-web-assets").getPublicUrl(path);
    return { ok: true, url: data.publicUrl, path };
  } catch (err) {
    console.error("[pagina-web][asset-upload] fatal:", err);
    return { ok: false, error: (err as Error).message };
  }
}
