/**
 * Rate limiter en memoria (sliding window simple por clave).
 *
 * Pensado para endpoints autenticados donde la clave es `userId` o `userId:ruta`.
 * Bajo Fluid Compute la instancia se reutiliza entre peticiones, así que
 * funciona como límite "soft" por instancia. Si necesitas garantías estrictas
 * cross-region, migrar a Upstash Redis.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { ok: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}
