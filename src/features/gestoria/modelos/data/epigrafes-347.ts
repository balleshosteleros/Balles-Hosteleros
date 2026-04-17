/**
 * Reglas de agrupación del Modelo 347 (Operaciones con terceros > 3.005,06 €/año).
 * Se agrupa por NIF del contacto. Declara si supera el umbral anual.
 * Ejercicio 2026.
 */

import { UMBRAL_MODELO_347 } from "../types/modelos";

export { UMBRAL_MODELO_347 };

export const CLAVES_OPERACION_347 = {
  A: "A — Adquisiciones de bienes y servicios",
  B: "B — Entregas de bienes y servicios",
  C: "C — Cobros por cuenta de terceros",
  D: "D — Adquisiciones efectuadas por entidades públicas",
  E: "E — Subvenciones, auxilios o ayudas satisfechas",
  F: "F — Ventas agencia de viajes",
  G: "G — Compras agencia de viajes",
} as const;

export type ClaveOperacion347 = keyof typeof CLAVES_OPERACION_347;

export const OPERACIONES_EXCLUIDAS_347 = [
  "retenciones_declaradas_en_111",
  "retenciones_declaradas_en_115",
  "operaciones_intracomunitarias_declaradas_en_349",
  "importaciones_exportaciones",
] as const;

export function claveOperacion347DesdeFactura(tipo: "COMPRA" | "VENTA"): ClaveOperacion347 {
  return tipo === "COMPRA" ? "A" : "B";
}
