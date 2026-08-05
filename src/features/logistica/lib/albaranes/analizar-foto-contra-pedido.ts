"use client";

/**
 * Foto → comparativa contra pedido por el camino FIABLE (PRP-073 F6).
 *
 * Sustituye en las pantallas de recepción al
 * `supabase.functions.invoke("analizar-albaran")` con base64: comprime la foto
 * en el navegador, la sube DIRECTA a Storage con credencial firmada y compara
 * en servidor con el extractor único. Mismo transporte que el alta libre — un
 * solo camino, con traza y reintento.
 *
 * Devuelve también el `importacionId` para adjuntar el original al albarán SIN
 * volver a subirlo (adjuntarDocumentoDesdeImportacion).
 */

import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import {
  iniciarImportacionAlbaran,
  completarSubidaAlbaran,
  compararImportacionConPedido,
} from "@/features/logistica/actions/importaciones-albaran-actions";
import type { AnalisisAlbaran } from "@/features/logistica/data/pedidos";
import type { LineaPedidoRef } from "./comparar-pedido";

const BUCKET = "logistica-albaranes";

/** Compresión idéntica a la del alta libre: foto de cámara (3-12 MB) → ~1-3 MB legible. */
export async function comprimirFotoAlbaran(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size <= 300_000) return f;
  try {
    const comprimido = await imageCompression(f, {
      maxSizeMB: 3,
      maxWidthOrHeight: 2560,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    return new File([comprimido], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: comprimido.type });
  } catch {
    // El navegador no supo decodificar (p.ej. HEIC en Chrome): sube el original
    // y el servidor decide si el formato es analizable.
    return f;
  }
}

export type ResultadoFotoContraPedido =
  | { ok: true; analisis: AnalisisAlbaran; importacionId: string }
  | { ok: false; error: string };

export async function analizarFotoContraPedido(
  file: File,
  lineasPedido: LineaPedidoRef[],
  pedidoId?: string | null,
): Promise<ResultadoFotoContraPedido> {
  const f = await comprimirFotoAlbaran(file);

  const ini = await iniciarImportacionAlbaran({
    flujo: "pedido",
    pedidoId: pedidoId ?? null,
    fileName: f.name,
    mimeType: f.type || "image/jpeg",
    size: f.size,
  });
  if (!ini.ok) return { ok: false, error: ini.message };

  const supabase = createClient();
  const up = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(ini.path, ini.token, f, { contentType: f.type || "application/octet-stream" });
  if (up.error) {
    return { ok: false, error: "La subida del archivo no llegó a completarse. Revisa la conexión e inténtalo de nuevo." };
  }

  const comp = await completarSubidaAlbaran({ importacionId: ini.importacionId });
  if (!comp.ok) return { ok: false, error: comp.message };

  const cmp = await compararImportacionConPedido({ importacionId: ini.importacionId, lineasPedido });
  if (!cmp.ok) return { ok: false, error: cmp.message };

  return { ok: true, analisis: cmp.analisis, importacionId: ini.importacionId };
}
