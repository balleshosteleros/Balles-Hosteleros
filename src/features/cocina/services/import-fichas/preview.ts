/**
 * Previsualización: une parser + matcher y produce el JSON que revisará el usuario.
 * PRP-071 — Fase 1. NO escribe en BD.
 */

import type { ParseResult } from "./types";
import type { Candidato, PreviewLinea, PreviewResult } from "./types";
import { emparejar, prepararCandidatos } from "./matcher";

/**
 * Construye la previsualización a partir de unas fichas ya parseadas y la lista
 * de candidatos de la BD (productos de compra + elaboraciones de la empresa).
 *
 * Es puro: no accede a BD ni a disco. La capa server (Fase 3/4) se encarga de
 * cargar `candidatos` desde Supabase y pasar `empresaId`.
 */
export function construirPreview(
  empresaId: string,
  parseResult: ParseResult,
  candidatos: Candidato[]
): PreviewResult {
  const prep = prepararCandidatos(candidatos);
  const lineas: PreviewLinea[] = [];
  const ingredientesUnicos = new Set<string>();

  let exacto = 0;
  let probable = 0;
  let dudoso = 0;
  let sinCandidato = 0;

  for (const ficha of parseResult.fichas) {
    for (const ing of ficha.ingredientes) {
      const match = emparejar(ing.nombre, prep);
      ingredientesUnicos.add(ing.nombre.toLowerCase().trim());

      switch (match.tipo) {
        case "exacto":
          exacto++;
          break;
        case "probable":
          probable++;
          break;
        case "dudoso":
          dudoso++;
          break;
        case "sin_candidato":
          sinCandidato++;
          break;
      }

      lineas.push({
        plato: ficha.plato,
        ingrediente: ing.nombre,
        unidad: ing.unidad,
        cantidad: ing.cantidad,
        match,
      });
    }
  }

  return {
    empresaId,
    resumen: {
      platos: parseResult.fichas.length,
      ingredientesUnicos: ingredientesUnicos.size,
      exacto,
      probable,
      dudoso,
      sinCandidato,
    },
    lineas,
    saltadas: parseResult.saltadas,
    candidatos,
  };
}
