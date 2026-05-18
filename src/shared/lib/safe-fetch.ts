/**
 * Fetch server-side con defensas anti-SSRF.
 *
 * Bloquea peticiones a:
 * - Hostnames distintos de http/https
 * - Localhost y loopback (127.0.0.0/8, ::1)
 * - Redes privadas RFC1918 (10/8, 172.16/12, 192.168/16)
 * - Link-local (169.254/16) — incluye AWS/GCP metadata
 * - IPv6 ULA (fc00::/7) y link-local (fe80::/10)
 * - Multicast / reservado
 *
 * Resuelve el hostname → IPs y valida TODAS las resueltas (no solo la primera)
 * para prevenir DNS rebinding. Sigue redirects manualmente revalidando cada hop.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_TIMEOUT_MS = 20_000;

export class SafeFetchError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SafeFetchError";
  }
}

function ipv4ToOctets(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return octets;
}

function isPrivateIPv4(ip: string): boolean {
  const o = ipv4ToOctets(ip);
  if (!o) return true; // si no parsea, bloquear por defecto
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGN
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // ::ffff:0:0/96 IPv4-mapped → extraer IPv4 y revalidar
  const mapped = lower.match(/^::ffff:([0-9a-f.:]+)$/);
  if (mapped) {
    const v4 = mapped[1].includes(".") ? mapped[1] : null;
    if (v4) return isPrivateIPv4(v4);
    return true;
  }
  // fc00::/7 ULA
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // fe80::/10 link-local
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // ff00::/8 multicast
  if (lower.startsWith("ff")) return true;
  return false;
}

function isPrivateIP(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true;
}

async function validateUrlOrThrow(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("invalid_url", "URL inválida");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SafeFetchError("invalid_protocol", "Solo se permiten URLs http/https");
  }
  const hostname = parsed.hostname;
  if (!hostname) throw new SafeFetchError("invalid_host", "Hostname vacío");

  // Si el hostname ya es una IP, validarla directamente.
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new SafeFetchError("blocked_ip", `IP bloqueada: ${hostname}`);
    }
    return parsed;
  }

  // Resolver DNS y validar TODAS las IPs (mitigar DNS rebinding).
  let resolved: { address: string; family: number }[] = [];
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new SafeFetchError("dns_error", `No se pudo resolver ${hostname}`);
  }
  if (resolved.length === 0) {
    throw new SafeFetchError("dns_empty", `Sin IPs para ${hostname}`);
  }
  for (const r of resolved) {
    if (isPrivateIP(r.address)) {
      throw new SafeFetchError("blocked_ip", `Hostname resuelve a IP privada: ${r.address}`);
    }
  }
  return parsed;
}

export interface SafeFetchOptions {
  maxRedirects?: number;
  maxBytes?: number;
  timeoutMs?: number;
  allowedContentTypes?: string[]; // ej. ["text/html", "application/xhtml+xml"]
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  contentType: string | null;
  body: string;
}

export async function safeFetchText(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const allowed = options.allowedContentTypes ?? null;

  let currentUrl = rawUrl;
  let hops = 0;
  while (true) {
    const validated = await validateUrlOrThrow(currentUrl);
    const res = await fetch(validated.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: options.headers,
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new SafeFetchError("redirect_no_location", "Redirect sin Location");
      }
      hops++;
      if (hops > maxRedirects) {
        throw new SafeFetchError("too_many_redirects", "Demasiados redirects");
      }
      currentUrl = new URL(loc, validated).toString();
      continue;
    }

    const contentType = res.headers.get("content-type");
    if (allowed && contentType) {
      const ctLower = contentType.toLowerCase();
      const ok = allowed.some((a) => ctLower.startsWith(a.toLowerCase()));
      if (!ok) {
        throw new SafeFetchError(
          "content_type_blocked",
          `Content-Type no permitido: ${contentType}`,
        );
      }
    }

    // Leer con límite de tamaño.
    const reader = res.body?.getReader();
    if (!reader) {
      return {
        status: res.status,
        finalUrl: validated.toString(),
        contentType,
        body: "",
      };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new SafeFetchError("too_large", `Respuesta excede ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
    return {
      status: res.status,
      finalUrl: validated.toString(),
      contentType,
      body: buf.toString("utf8"),
    };
  }
}
