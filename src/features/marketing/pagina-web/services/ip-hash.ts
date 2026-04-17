/**
 * Hash determinístico de IP para RGPD: sha256(ip + salt_servidor).
 * salt leído de env var PAGINA_WEB_IP_SALT o fallback a constante.
 */
import { createHash } from "crypto";

export function ipHash(rawIp: string | null | undefined): string | null {
  if (!rawIp) return null;
  const salt = process.env.PAGINA_WEB_IP_SALT ?? "balles-hosteleros-pagina-web-v1";
  return createHash("sha256").update(`${rawIp}:${salt}`).digest("hex").slice(0, 32);
}

export function truncarUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return ua.slice(0, 120);
}

/** Extrae IP real del request detrás de proxies (Vercel / Cloudflare). */
export function extraerIp(headers: Headers): string | null {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}
