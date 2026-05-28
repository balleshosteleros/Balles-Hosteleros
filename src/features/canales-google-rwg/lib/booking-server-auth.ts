/**
 * Auth del Booking Server (Google → Balles).
 * Google manda Authorization: Basic base64("google:<SECRET>") en cada llamada.
 * Comparamos SECRET contra GOOGLE_RWG_AUTH_TOKEN en timing-safe.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isRwgEnabled(): boolean {
  return process.env.GOOGLE_RWG_ENABLED === "true";
}

export function validateBookingServerAuth(request: Request): { ok: true } | { ok: false; reason: string } {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) {
    return { ok: false, reason: "missing_basic_auth" };
  }
  let decoded: string;
  try {
    decoded = atob(header.slice(6).trim());
  } catch {
    return { ok: false, reason: "invalid_base64" };
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return { ok: false, reason: "invalid_basic_payload" };
  const secret = decoded.slice(idx + 1);

  const expected = process.env.GOOGLE_RWG_AUTH_TOKEN?.trim();
  if (!expected) return { ok: false, reason: "server_missing_token" };
  if (!timingSafeEqual(secret, expected)) return { ok: false, reason: "bad_token" };

  return { ok: true };
}
