import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const TOKEN_PEPPER_ENV = "FIRMA_TOKEN_PEPPER";
const OTP_PEPPER_ENV = "FIRMA_OTP_PEPPER";

function getPepper(envName: string): string {
  const v = process.env[envName];
  if (!v || v.length < 16) {
    throw new Error(
      `[firmas/crypto] Falta env ${envName} (mínimo 16 caracteres). Configúralo en .env.local y en Vercel.`,
    );
  }
  return v;
}

export function sha256(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return createHash("sha256").update(buf).digest("hex");
}

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  const pepper = getPepper(TOKEN_PEPPER_ENV);
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function compararToken(token: string, hashEsperado: string): boolean {
  const calculado = Buffer.from(hashToken(token), "hex");
  const esperado = Buffer.from(hashEsperado, "hex");
  if (calculado.length !== esperado.length) return false;
  return timingSafeEqual(calculado, esperado);
}

export function generarOTP(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOTP(codigo: string, documentoId: string): string {
  const pepper = getPepper(OTP_PEPPER_ENV);
  return createHmac("sha256", pepper).update(`${documentoId}:${codigo}`).digest("hex");
}

export function compararOTP(codigo: string, documentoId: string, hashEsperado: string): boolean {
  const calculado = Buffer.from(hashOTP(codigo, documentoId), "hex");
  const esperado = Buffer.from(hashEsperado, "hex");
  if (calculado.length !== esperado.length) return false;
  return timingSafeEqual(calculado, esperado);
}

export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`);
  return `{${entries.join(",")}}`;
}
