/**
 * Emparejado de una línea leída de un albarán (por foto/OCR) contra el catálogo de
 * productos de compra de la empresa.
 *
 * A diferencia del matcher factura↔albarán (`comparar-lineas.ts`, que casa la línea OCR
 * contra las líneas que YA trae el albarán de sistema), este busca en el CATÁLOGO entero
 * y compara por DOS campos:
 *   1. `nombreProveedor` — cómo nombra el proveedor a ese producto (casilla de la ficha).
 *      Es el más fiable: si coincide, el usuario ya enseñó esa asociación antes.
 *   2. `nombre` — nuestro nombre interno (respaldo cuando aún no hay alias guardado).
 *
 * Decisión de negocio (2026-07-29): un solo `nombreProveedor` por producto.
 */

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  nombreProveedor?: string | null;
}

export interface CandidatoMatch {
  producto: ProductoCatalogo;
  /** 0..1 — mejor similitud entre el texto leído y (nombre | nombreProveedor). */
  score: number;
  /** Qué campo dio la mejor puntuación (para explicar al usuario por qué se sugiere). */
  via: "nombre_proveedor" | "nombre";
}

export interface ResultadoMatch {
  /** Ligado automático: hay un candidato con score >= UMBRAL_EXACTO. */
  exacto: CandidatoMatch | null;
  /** Candidatos por encima del umbral de propuesta, ordenados de mejor a peor. */
  candidatos: CandidatoMatch[];
}

// Umbrales. "Exacto" es deliberadamente alto: solo liga solo si está muy seguro; el resto
// lo confirma una persona en el asistente.
export const UMBRAL_EXACTO = 0.92;
export const UMBRAL_PROPUESTA = 0.55;
const MAX_CANDIDATOS = 6;

export function normalizarNombre(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** Similitud 0..1 entre dos textos (1 = idénticos tras normalizar). */
export function similitud(a: string, b: string): number {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (!na.length || !nb.length) return 0;
  // Bonus fuerte si una cadena contiene a la otra (p.ej. "coca cola zero 2l" ⊃ "coca cola").
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const base = 1 - dist / Math.max(na.length, nb.length);
  const contiene = na.includes(nb) || nb.includes(na);
  return contiene ? Math.max(base, 0.9) : base;
}

/**
 * Empareja el texto leído del albarán contra el catálogo.
 * @param textoLeido  nombre de la línea tal cual lo leyó la IA del albarán.
 * @param catalogo    productos de compra de la empresa.
 */
export function emparejarConCatalogo(
  textoLeido: string,
  catalogo: ProductoCatalogo[],
): ResultadoMatch {
  const texto = (textoLeido ?? "").trim();
  if (!texto) return { exacto: null, candidatos: [] };

  const puntuados: CandidatoMatch[] = [];
  for (const p of catalogo) {
    const scoreNombre = similitud(texto, p.nombre);
    const scoreAlias = p.nombreProveedor ? similitud(texto, p.nombreProveedor) : 0;
    // El alias del proveedor manda: si empata, gana el alias (asociación aprendida).
    const via = scoreAlias >= scoreNombre ? "nombre_proveedor" : "nombre";
    const score = Math.max(scoreNombre, scoreAlias);
    if (score >= UMBRAL_PROPUESTA) {
      puntuados.push({ producto: p, score, via });
    }
  }

  puntuados.sort((a, b) => b.score - a.score);
  const mejor = puntuados[0] ?? null;
  const exacto = mejor && mejor.score >= UMBRAL_EXACTO ? mejor : null;

  return {
    exacto,
    candidatos: puntuados.slice(0, MAX_CANDIDATOS),
  };
}
