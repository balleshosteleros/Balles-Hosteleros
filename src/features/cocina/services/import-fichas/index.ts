/**
 * Importador de fichas técnicas (escandallos) desde Excel — PRP-071.
 * Fase 1: parser + emparejador + previsualización. No toca BD.
 */

export * from "./types";
export { parseWorkbook, parseFichasFile, parseFichasBuffer } from "./parser";
export {
  normalizar,
  emparejar,
  prepararCandidatos,
  UMBRAL_EXACTO,
  UMBRAL_PROBABLE,
} from "./matcher";
export { construirPreview } from "./preview";
