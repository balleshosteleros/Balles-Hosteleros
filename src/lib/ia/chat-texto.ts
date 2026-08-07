/**
 * Chat conversacional del soporte.
 *
 * ANTES pasaba por OpenRouter, que a su vez revendía `google/gemini-2.5-flash`:
 * un intermediario (y una key extra, `OPENROUTER_API_KEY`, que nunca llegó a
 * configurarse — el chat de soporte llevaba tiempo respondiendo sin IA).
 *
 * AHORA llama a Google directamente con la `GEMINI_API_KEY` que ya usa el resto
 * del sistema: mismo modelo, un proveedor menos, una sola key.
 *
 */
import { geminiTexto } from "./gemini";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function chatTexto(
  messages: ChatMsg[],
  opts: { temperature?: number } = {},
): Promise<string | null> {
  return geminiTexto(messages, { temperature: opts.temperature ?? 0.3 });
}
