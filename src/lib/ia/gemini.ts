/**
 * Cliente Gemini — Google AI Studio (tier free).
 *
 * Uso: llamadas server-side únicamente. Lee GEMINI_API_KEY.
 * Usa structured output (responseSchema) para garantizar JSON válido.
 */
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GeminiKeyMissingError extends Error {
  constructor() {
    super("GEMINI_API_KEY no configurada en variables de entorno");
    this.name = "GeminiKeyMissingError";
  }
}

export interface GeminiJSONOptions {
  model?: string;
  systemInstruction?: string;
  responseSchema: Schema;
  temperature?: number;
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

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch (err) {
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
