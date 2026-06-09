/**
 * Cliente Gemini — Google AI Studio (tier free).
 *
 * Uso: llamadas server-side únicamente. Lee GEMINI_API_KEY.
 * Usa structured output (responseSchema) para garantizar JSON válido.
 */
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export class GeminiKeyMissingError extends Error {
  constructor() {
    super("GEMINI_API_KEY no configurada en variables de entorno");
    this.name = "GeminiKeyMissingError";
  }
}

export interface GeminiInlineAttachment {
  /** Tipo MIME (e.g. "image/jpeg", "application/pdf"). */
  mimeType: string;
  /** Contenido del archivo en base64 (sin prefijo data:). */
  base64: string;
}

export interface GeminiJSONOptions {
  model?: string;
  systemInstruction?: string;
  responseSchema: Schema;
  temperature?: number;
  /** Adjuntos multimodales (imágenes, PDFs). Gemini los lee de forma nativa. */
  attachments?: GeminiInlineAttachment[];
}

export interface GeminiJSONResult<T> {
  data: T;
  tokensInput: number | null;
  tokensOutput: number | null;
  modelo: string;
}

export async function geminiJSON<T = unknown>(
  prompt: string,
  opts: GeminiJSONOptions,
): Promise<GeminiJSONResult<T>> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiKeyMissingError();

  const modelo = opts.model || DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelo,
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
      temperature: opts.temperature ?? 0.5,
    },
  });

  const hasAttachments = opts.attachments && opts.attachments.length > 0;
  const result = hasAttachments
    ? await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...opts.attachments!.map((a) => ({
                inlineData: { mimeType: a.mimeType, data: a.base64 },
              })),
            ],
          },
        ],
      })
    : await model.generateContent(prompt);
  const text = result.response.text();

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    console.error("[gemini] JSON parse error. Raw output:", text);
    throw new Error("El modelo no devolvió un JSON válido.");
  }

  const usage = result.response.usageMetadata;
  return {
    data,
    tokensInput: usage?.promptTokenCount ?? null,
    tokensOutput: usage?.candidatesTokenCount ?? null,
    modelo,
  };
}
