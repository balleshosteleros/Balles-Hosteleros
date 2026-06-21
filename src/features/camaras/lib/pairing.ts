import crypto from "crypto";

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) para códigos legibles a mano.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Código de emparejamiento legible (un solo uso). Ej: "K7P2-9QXM". */
export function generarPairingCode(): string {
  const bytes = crypto.randomBytes(8);
  let raw = "";
  for (let i = 0; i < 8; i++) raw += ALPHABET[bytes[i] % ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Secreto del appliance entregado una sola vez tras emparejar. */
export function generarDeviceToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Hash determinista para guardar el token (nunca el secreto en claro). */
export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Minutos de validez del código de emparejamiento. */
export const PAIRING_TTL_MIN = 15;
