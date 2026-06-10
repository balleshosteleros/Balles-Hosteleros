/**
 * Nombres canónicos de módulo del software (PRP-055).
 *
 * DEBEN casar EXACTAMENTE con `src/lib/seeds/roles.ts` y con `puedeVer()`
 * (UPPERCASE + acentos). La etiqueta `modulo` de cada chunk de conocimiento usa
 * uno de estos valores para que el candado de rol funcione.
 */
export const MODULOS_CANONICOS = [
  "DIRECCIÓN",
  "SALA",
  "COCINA",
  "GERENCIA",
  "CALIDAD",
  "RECURSOS HUMANOS",
  "MARKETING",
  "LOGÍSTICA",
  "CONTABILIDAD",
  "GESTORÍA",
  "JURÍDICO",
  "AJUSTES",
] as const;

/** Módulo universal: contenido visible para CUALQUIER rol (agenda, cómo usar la app, etc.). */
export const MODULO_GENERAL = "GENERAL";

/** Todos los valores válidos para la columna `modulo` de soporte_conocimiento. */
export const MODULOS_SOPORTE = [...MODULOS_CANONICOS, MODULO_GENERAL] as const;

export type ModuloCanonico = (typeof MODULOS_CANONICOS)[number];
export type ModuloSoporte = (typeof MODULOS_SOPORTE)[number];
