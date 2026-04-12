/**
 * Cliente mínimo para llamar a OpenRouter (compatible con OpenAI Chat API).
 *
 * Lee la key de OPENROUTER_API_KEY. Si no existe, devuelve null para que el
 * caller use un fallback.
 */
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const MODEL = "google/gemini-2.5-flash";

export async function openrouterChat(
  messages: ChatMsg[],
  opts: { temperature?: number } = {},
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: opts.temperature ?? 0.3,
      }),
    });
    if (!res.ok) {
      console.error("[openrouter]", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[openrouter] error:", err);
    return null;
  }
}
