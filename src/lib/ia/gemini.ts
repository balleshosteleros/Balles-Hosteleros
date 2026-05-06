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
  // Clave de OpenRouter provista por el usuario (o la de las variables de entorno)
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new GeminiKeyMissingError();

  const modelToUse = "google/gemini-2.0-flash-001"; // Modelo en OpenRouter

  // Inyectamos el JSON schema y un ejemplo claro para que la IA no devuelva un Array suelto
  const sysMsg = (opts.systemInstruction || "") + `

DEBES RESPONDER ÚNICAMENTE CON UN OBJETO JSON VÁLIDO QUE CUMPLA ESTE ESQUEMA EXACTO:
${JSON.stringify(opts.responseSchema)}

EJEMPLO DE ESTRUCTURA OBLIGATORIA:
{
  "titulo": "El título general",
  "slides": [
    { "layout": "portada", "titulo": "...", "cuerpo": "..." },
    { "layout": "bullets", "titulo": "...", "bullets": ["..."] }
  ]
}
NO DEVUELVAS UN ARRAY COMO RAÍZ. LA RAÍZ DEBE SER UN OBJETO CON 'titulo' y 'slides'.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        { role: "system", content: sysMsg },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: opts.temperature ?? 0.5
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("[OpenRouter Error]", errorText);
    throw new Error(`Error de OpenRouter: ${res.status}`);
  }

  const jsonResponse = await res.json();
  const textOutput = jsonResponse.choices[0]?.message?.content || "{}";
  
  // Limpiamos el texto por si el modelo devuelve markdown (```json ... ```)
  const cleaned = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
  
  let data: T;
  try {
    data = JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("[OpenRouter] Parse Error en JSON devuelto:", cleaned);
    throw new Error("El modelo no devolvió un JSON válido.");
  }

  return {
    data,
    tokensInput: jsonResponse.usage?.prompt_tokens ?? null,
    tokensOutput: jsonResponse.usage?.completion_tokens ?? null,
    modelo: modelToUse,
  };
}
