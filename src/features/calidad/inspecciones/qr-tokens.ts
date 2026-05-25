/**
 * Helpers para tokens QR de verificación in-situ de inspecciones (PRP-041).
 * - Token: 24 bytes randomBytes → base64url (URL-safe, ~32 chars).
 * - Caducidad: 2 horas desde generación (ventana real entre inspección y
 *   pago en mesa). La pantalla del inspector NO muestra cuenta atrás —
 *   solo informa si ya caducó.
 * - URL absoluta apuntando a NEXT_PUBLIC_APP_URL.
 */
import { randomBytes } from "node:crypto";

const DEFAULT_BASE = "https://sistema.balleshosteleros.com";

export const QR_TTL_MINUTES = 120;

export function generateQrToken(): string {
  return randomBytes(24).toString("base64url");
}

export function qrExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + QR_TTL_MINUTES * 60_000);
}

export function qrVerifyUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? DEFAULT_BASE;
  return `${base}/inspecciones/verificar/${encodeURIComponent(token)}`;
}
