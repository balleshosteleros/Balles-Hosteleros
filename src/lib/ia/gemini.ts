/**
 * Cliente Gemini — Google AI Studio (tier free).
 *
 * Uso: llamadas server-side únicamente. Lee GEMINI_API_KEY.
 * Prefiere structured output (responseSchema) a prompt engineering.
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
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiKeyMissingError();

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: opts.model ?? DEFAULT_MODEL,
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
      temperature: opts.temperature ?? 0.5,
    },
  });

  const res = await model.generateContent(prompt);
  const text = res.response.text();
  const data = JSON.parse(text) as T;
  const usage = res.response.usageMetadata;

  return {
    data,
    tokensInput: usage?.promptTokenCount ?? null,
    tokensOutput: usage?.candidatesTokenCount ?? null,
    modelo: opts.model ?? DEFAULT_MODEL,
  };
}
