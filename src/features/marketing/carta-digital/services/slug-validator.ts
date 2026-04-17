/**
 * Validador de slugs públicos para Carta Digital (PRP-028).
 * Reglas: kebab-case, 3-40 chars, no rutas reservadas, único por empresa.
 */
import type { SlugValidationResult } from "../types";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const RUTAS_RESERVADAS = new Set([
  "admin",
  "api",
  "auth",
  "carta",
  "cocina",
  "contabilidad",
  "dashboard",
  "direccion",
  "gerencia",
  "gestoria",
  "juridico",
  "login",
  "logistica",
  "logout",
  "marketing",
  "rrhh",
  "sala",
  "settings",
  "signup",
  "soporte",
  "test",
  "ajustes",
  "ayuda",
  "onboarding",
  "_next",
  "next",
  "static",
  "public",
]);

export function normalizarSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validarSlugFormato(slug: string): SlugValidationResult {
  if (!slug || slug.length < 3) {
    return { ok: false, error: "El slug debe tener al menos 3 caracteres." };
  }
  if (slug.length > 40) {
    return { ok: false, error: "El slug no puede tener más de 40 caracteres." };
  }
  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      error: "Sólo letras minúsculas, números y guiones (kebab-case).",
    };
  }
  if (RUTAS_RESERVADAS.has(slug)) {
    return { ok: false, error: "Ese nombre está reservado por el sistema." };
  }
  return { ok: true, slug };
}
