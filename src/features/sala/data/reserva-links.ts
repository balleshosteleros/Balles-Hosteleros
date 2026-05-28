export interface ReservaLink {
  id: string;
  empresaId: string;
  palabraClave: string;
  urlGenerada: string;
  activo: boolean;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PALABRA_CLAVE_REGEX = /^[A-Z0-9_]+$/;
export const PALABRA_CLAVE_MAX = 32;

export function validarPalabraClave(raw: string): { ok: true; valor: string } | { ok: false; error: string } {
  const valor = raw.trim().toUpperCase();
  if (!valor) return { ok: false, error: "La palabra clave no puede estar vacía" };
  if (valor.length > PALABRA_CLAVE_MAX) return { ok: false, error: `Máximo ${PALABRA_CLAVE_MAX} caracteres` };
  if (!PALABRA_CLAVE_REGEX.test(valor)) return { ok: false, error: "Solo letras mayúsculas, números y _" };
  return { ok: true, valor };
}

export function buildReservaUrl(empresaSlug: string, palabraClave: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com";
  return `${base.replace(/\/$/, "")}/reservar/${empresaSlug}?o=${palabraClave}`;
}
