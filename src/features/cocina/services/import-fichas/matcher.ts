/**
 * Emparejador de ingredientes del Excel contra candidatos de la BD
 * (productos de compra + elaboraciones existentes).
 * PRP-071 — Fase 1. El usuario SIEMPRE confirma lo no-exacto.
 */

import type { Candidato, MatchResult, MatchTipo } from "./types";

// Umbrales (ajustables). Validados con el Excel real: exacto 29, probable 34.
export const UMBRAL_EXACTO = 0.99;
export const UMBRAL_PROBABLE = 0.55;

/** Normaliza para comparar: minúsculas, sin acentos, sin paréntesis ni signos. */
export function normalizar(s: string): string {
  return String(s)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .replace(/\([^)]*\)/g, " ") // (350GR), (1L)…
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(n: string): string[] {
  return n.split(" ").filter(Boolean);
}

interface CandidatoNorm {
  cand: Candidato;
  n: string;
  tokens: Set<string>;
}

/** Pre-normaliza candidatos una vez para reusar en muchos ingredientes. */
export function prepararCandidatos(candidatos: Candidato[]): CandidatoNorm[] {
  return candidatos.map((cand) => {
    const n = normalizar(cand.nombre);
    return { cand, n, tokens: new Set(tokens(n)) };
  });
}

function clasificar(score: number): MatchTipo {
  if (score >= UMBRAL_EXACTO) return "exacto";
  if (score >= UMBRAL_PROBABLE) return "probable";
  return "dudoso";
}

/** Empareja un ingrediente crudo contra el conjunto de candidatos pre-normalizados. */
export function emparejar(
  ingredienteRaw: string,
  candidatos: CandidatoNorm[]
): MatchResult {
  const q = normalizar(ingredienteRaw);
  const qTokens = tokens(q);

  if (qTokens.length === 0) {
    return { ingrediente: ingredienteRaw, candidato: null, score: 0, tipo: "sin_candidato" };
  }

  let best: Candidato | null = null;
  let bestScore = 0;

  for (const c of candidatos) {
    if (c.n === q) {
      return { ingrediente: ingredienteRaw, candidato: c.cand, score: 1, tipo: "exacto" };
    }
    // Solapamiento de tokens, ponderado al tamaño del ingrediente.
    let common = 0;
    for (const t of qTokens) if (c.tokens.has(t)) common++;
    let score = common / qTokens.length;
    // Bonus si uno contiene al otro (cubre "Lima" vs "Limas", "Gambon" vs "Gambones").
    if (c.n.includes(q) || q.includes(c.n)) score = Math.max(score, 0.85);

    if (score > bestScore) {
      bestScore = score;
      best = c.cand;
    }
  }

  if (!best || bestScore === 0) {
    return { ingrediente: ingredienteRaw, candidato: null, score: 0, tipo: "sin_candidato" };
  }

  return {
    ingrediente: ingredienteRaw,
    candidato: best,
    score: bestScore,
    tipo: clasificar(bestScore),
  };
}
