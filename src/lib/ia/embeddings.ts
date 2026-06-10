import "server-only";

/**
 * Capa de embeddings para el soporte RAG (PRP-055).
 *
 * Usa el modelo local `gte-small` del Edge Runtime de Supabase (gratis, sin
 * claves externas) vía la edge function `soporte-embeddings`. Devuelve vectores
 * de 384 dimensiones — DEBE coincidir con la columna VECTOR(384) y la RPC.
 *
 * Cambiar de modelo o dimensión obliga a re-embeber TODA la tabla.
 */

export const EMBEDDING_DIMS = 384;

/** Genera un embedding por cada texto. Devuelve null si falla (caller decide fallback). */
export async function generarEmbeddings(texts: string[]): Promise<number[][] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || texts.length === 0) return null;

  try {
    const res = await fetch(`${url}/functions/v1/soporte-embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) {
      console.error("[embeddings]", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { embeddings?: number[][] };
    return data.embeddings ?? null;
  } catch (err) {
    console.error("[embeddings] error:", err);
    return null;
  }
}

/** Atajo para un único texto (p. ej. la pregunta del usuario). */
export async function generarEmbedding(text: string): Promise<number[] | null> {
  const out = await generarEmbeddings([text]);
  return out?.[0] ?? null;
}
