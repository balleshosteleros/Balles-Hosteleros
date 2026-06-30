/**
 * Tipos del importador de fichas técnicas (escandallos) desde Excel.
 * PRP-071 — Fase 1: parser + emparejador. No toca BD.
 */

/** Un ingrediente tal como viene en una hoja del Excel. */
export interface IngredienteParsed {
  /** Nombre crudo del Excel (p. ej. "cebolla morada"). */
  nombre: string;
  /** Unidad cruda (g, ml, uni, cs…). */
  unidad: string;
  /** Cantidad numérica; null si venía vacía o no parseable. */
  cantidad: number | null;
}

/** El escandallo de un plato, parseado de una hoja. */
export interface FichaParsed {
  /** Nombre del plato (fila 1). */
  plato: string;
  /** Categoría de venta (fila 5, col C). */
  categoria: string | null;
  /** Partida si aparece. */
  partida: string | null;
  /** Texto de elaboración si aparece. */
  elaboracion: string | null;
  ingredientes: IngredienteParsed[];
  /** Nombre de la hoja origen (para trazabilidad). */
  hoja: string;
}

export interface ParseResult {
  fichas: FichaParsed[];
  /** Hojas que no tenían sección de ingredientes detectable. */
  saltadas: string[];
}

/** Un candidato de la BD contra el que emparejar (producto compra o elaboración). */
export interface Candidato {
  id: string;
  nombre: string;
  /** 'compra' = producto que se compra; 'elaboracion' = sub-receta (otra ficha). */
  tipo: "compra" | "elaboracion";
  categoria?: string | null;
}

export type MatchTipo = "exacto" | "probable" | "dudoso" | "sin_candidato";

export interface MatchResult {
  /** Ingrediente crudo del Excel. */
  ingrediente: string;
  /** Candidato sugerido (null si no hay ninguno). */
  candidato: Candidato | null;
  /** Score 0..1. */
  score: number;
  tipo: MatchTipo;
}

/** Línea de previsualización: un ingrediente de un plato con su emparejado. */
export interface PreviewLinea {
  plato: string;
  ingrediente: string;
  unidad: string;
  cantidad: number | null;
  match: MatchResult;
}

export interface PreviewResult {
  empresaId: string;
  /** Resumen agregado para la cabecera de la UI. */
  resumen: {
    platos: number;
    ingredientesUnicos: number;
    exacto: number;
    probable: number;
    dudoso: number;
    sinCandidato: number;
  };
  /** Todas las líneas, agrupables por plato en la UI. */
  lineas: PreviewLinea[];
  saltadas: string[];
  /** Catálogo de candidatos (para el combobox de corrección en la UI). */
  candidatos: Candidato[];
}
