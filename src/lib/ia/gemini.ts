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

/**
 * Cuota de la API agotada (429). En el tier free el límite es POR DÍA (p.ej. 20
 * peticiones/día por modelo), así que reintentar en segundos no sirve de nada.
 * El mensaje está pensado para enseñarse tal cual al usuario final.
 */
export class GeminiQuotaError extends Error {
  constructor() {
    super(
      "La IA que lee los documentos ha alcanzado su límite diario de uso. " +
        "Vuelve a intentarlo mañana por la mañana o avisa al administrador para ampliar el plan.",
    );
    this.name = "GeminiQuotaError";
  }
}

/** ¿El fallo del SDK es un 429 de cuota o rate-limit? */
function esErrorDeCuota(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|Too Many Requests|quota|resource.?exhausted/i.test(msg);
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
  let result;
  try {
    result = hasAttachments
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
  } catch (err) {
    // El volcado crudo del SDK (URL, JSON de violations…) no debe llegar al usuario.
    if (esErrorDeCuota(err)) throw new GeminiQuotaError();
    throw err;
  }
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

/**
 * Respuesta en TEXTO libre (sin esquema JSON). Para chats conversacionales.
 *
 * Devuelve null si no hay key o si la llamada falla, para que el caller pueda
 * caer a su propio fallback sin romper la pantalla.
 */
export async function geminiTexto(
  mensajes: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts: { temperature?: number; model?: string } = {},
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  try {
    const sistema = mensajes
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const conversacion = mensajes.filter((m) => m.role !== "system");

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: opts.model || DEFAULT_MODEL,
      systemInstruction: sistema || undefined,
      generationConfig: { temperature: opts.temperature ?? 0.3 },
    });

    const result = await model.generateContent({
      contents: conversacion.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    });

    return result.response.text() || null;
  } catch (err) {
    console.error("[gemini][texto]", err);
    return null;
  }
}
