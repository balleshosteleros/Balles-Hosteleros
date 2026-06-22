import type { OrigenCandidatura } from "@/features/rrhh/data/reclutamiento";

/** Enlace de atribución por canal del portal de empleo. */
export interface EmpleoLink {
  id: string;
  empresaId: string;
  codigo: string;
  nombre: string;
  origenCategoria: OrigenCandidatura;
  urlGenerada: string;
  activo: boolean;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CODIGO_REGEX = /^[A-Z0-9_]+$/;
export const CODIGO_MAX = 32;

export function validarCodigo(
  raw: string,
): { ok: true; valor: string } | { ok: false; error: string } {
  const valor = raw.trim().toUpperCase();
  if (!valor) return { ok: false, error: "El código no puede estar vacío" };
  if (valor.length > CODIGO_MAX) return { ok: false, error: `Máximo ${CODIGO_MAX} caracteres` };
  if (!CODIGO_REGEX.test(valor)) return { ok: false, error: "Solo letras mayúsculas, números y _" };
  return { ok: true, valor };
}

/** URL pública del portal de empleo con la atribución de canal. */
export function buildEmpleoUrl(empleoSlug: string, codigo: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com";
  return `${base.replace(/\/$/, "")}/empleo/${empleoSlug}?o=${codigo.toLowerCase()}`;
}
