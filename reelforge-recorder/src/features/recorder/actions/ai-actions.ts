"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const openrouter = createOpenAI({
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
    "X-Title": "ReelForge Recorder",
  },
});

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet";

export async function suggestRecordingTitle(context?: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    return `Grabación ${new Date().toLocaleDateString("es-ES")}`;
  }

  const prompt = `Eres un asistente para una herramienta de grabación de pantalla profesional llamada ReelForge Recorder.
Tu tarea es sugerir un título corto, profesional y atractivo para una nueva grabación.

CONTEXTO DEL USUARIO:
${context || "No se proporcionó contexto específico, es una grabación general."}

REGLAS:
1. Máximo 5-7 palabras.
2. Usa un tono profesional pero moderno.
3. Si el contexto es vago, usa algo como "Tutorial de Pantalla - [Fecha]" o "Demo de Producto".
4. Retorna SOLO el título, sin comillas ni explicaciones.
5. Idioma: Español.`;

  try {
    const { text } = await generateText({
      model: openrouter(MODEL),
      prompt,
      temperature: 0.7,
      maxTokens: 50,
    });

    return text.trim().replace(/^"|"$/g, "");
  } catch (error) {
    console.error("AI Title Suggestion Error:", error);
    return `Grabación ${new Date().toLocaleDateString("es-ES")}`;
  }
}
