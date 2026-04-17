/**
 * Rate-limit en memoria para likes públicos.
 * MVP: cache LRU simple por proceso (~5 min). Para producción multi-instancia
 * sustituir por Upstash Redis o tabla efímera con cleanup.
 */
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 60;

const buckets = new Map<string, number[]>();

function purge(key: string, now: number) {
  const arr = buckets.get(key);
  if (!arr) return;
  const limpios = arr.filter((t) => now - t < VENTANA_MS);
  if (limpios.length === 0) buckets.delete(key);
  else buckets.set(key, limpios);
}

export function permitirLike(ipHash: string): boolean {
  const now = Date.now();
  purge(ipHash, now);
  const arr = buckets.get(ipHash) ?? [];
  if (arr.length >= MAX_POR_VENTANA) return false;
  arr.push(now);
  buckets.set(ipHash, arr);
  return true;
}

const SALT = process.env.CARTA_LIKE_SALT ?? "balles-hosteleros-carta-2026";

export async function hashIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  const enc = new TextEncoder().encode(`${SALT}:${ip}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
