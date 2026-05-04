/**
 * Cliente Gemini Image — generación de imágenes con preservación facial.
 *
 * Modelo: gemini-2.5-flash-image-preview ("nano-banana").
 * Acepta múltiples imágenes de entrada (foto del empleado + logo de empresa)
 * y devuelve una imagen PNG generada.
 *
 * Uso: server-side únicamente. Lee GEMINI_API_KEY (mismo tier free que gemini.ts).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiKeyMissingError } from "./gemini";

const IMAGE_MODEL = "gemini-2.5-flash-image-preview";

export interface GeminiImageInput {
  /** Datos binarios de la imagen (Buffer en server, ArrayBuffer en cliente). */
  data: Buffer;
  /** MIME type ej. "image/jpeg", "image/png". */
  mimeType: string;
}

export interface GeminiImageResult {
  /** PNG generada como Buffer (lista para subir a Storage). */
  imageBuffer: Buffer;
  modelo: string;
}

/**
 * Genera una imagen a partir de un prompt y N imágenes de referencia.
 * Lanza GeminiKeyMissingError si no hay key. Lanza Error si la respuesta
 * de Gemini no contiene imagen (p.ej. el modelo respondió texto por safety).
 */
export async function geminiImage(
  prompt: string,
  inputs: GeminiImageInput[],
): Promise<GeminiImageResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiKeyMissingError();

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

  const parts = [
    { text: prompt },
    ...inputs.map((img) => ({
      inlineData: { data: img.data.toString("base64"), mimeType: img.mimeType },
    })),
  ];

  const res = await model.generateContent({ contents: [{ role: "user", parts }] });
  const candidates = res.response.candidates ?? [];
  for (const cand of candidates) {
    for (const part of cand.content?.parts ?? []) {
      const inline = (part as { inlineData?: { data: string; mimeType: string } }).inlineData;
      if (inline?.data) {
        return {
          imageBuffer: Buffer.from(inline.data, "base64"),
          modelo: IMAGE_MODEL,
        };
      }
    }
  }
  throw new Error("Gemini no devolvió imagen (posible bloqueo por safety o cuota agotada).");
}

/** Descarga una imagen pública (avatar real, logo) y devuelve Buffer + MIME. */
export async function fetchImageAsInput(url: string): Promise<GeminiImageInput> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar imagen: ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  return { data: buf, mimeType };
}
