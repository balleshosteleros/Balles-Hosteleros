/**
 * Punto único de import para la capa de servicios de logística.
 * Uso desde UI:
 *   import { parseProveedoresFile, parseProductosFile, parseEscandallosFile } from "@/features/logistica/services";
 */

export { parseProveedoresFile } from "./parser-proveedores";
export { parseProductosFile } from "./parser-productos";
export { parseEscandallosFile } from "./parser-escandallos";
export { readSheet, getField, parseNumber, parseStringArray, normalizeHeader } from "./parser-excel";
