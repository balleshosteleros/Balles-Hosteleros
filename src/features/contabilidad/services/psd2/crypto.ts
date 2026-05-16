import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function keyBytes(): Buffer {
  const raw = process.env.BANK_TOKENS_KEY?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "BANK_TOKENS_KEY no definida o demasiado corta (mínimo 32 caracteres).",
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]);
}

export function decryptToken(blob: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Token cifrado inválido.");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const enc = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALG, keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
