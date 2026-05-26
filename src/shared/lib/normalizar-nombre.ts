// Partículas que en español/portugués mantienen minúscula salvo al inicio.
const PARTICULAS_NOMBRE = new Set([
  "de", "del", "la", "las", "los", "y", "e",
  "da", "do", "das", "dos",
  "van", "von",
]);

function capitalizarToken(token: string): string {
  if (!token) return token;
  // Maneja apóstrofes (O'Brien) y guiones (Mary-Ann)
  return token
    .split("-")
    .map((seg) =>
      seg
        .split("'")
        .map((s) =>
          s
            ? s.charAt(0).toLocaleUpperCase("es-ES") +
              s.slice(1).toLocaleLowerCase("es-ES")
            : s,
        )
        .join("'"),
    )
    .join("-");
}

/**
 * Normaliza nombres y apellidos:
 * - Trim + colapsa espacios múltiples.
 * - Primera letra de cada palabra en mayúscula, resto en minúscula.
 * - Respeta partículas comunes (de, del, la, los, y…) en minúscula salvo al inicio.
 * - Conserva apóstrofes y guiones (O'Brien, Mary-Ann).
 */
export function normalizarNombre(input: string | null | undefined): string {
  if (!input) return "";
  const limpio = input.trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  return limpio
    .split(" ")
    .map((tok, i) => {
      const lower = tok.toLocaleLowerCase("es-ES");
      if (i > 0 && PARTICULAS_NOMBRE.has(lower)) return lower;
      return capitalizarToken(tok);
    })
    .join(" ");
}

/**
 * Wrapper para nullable: si la entrada está vacía/null devuelve null,
 * útil al pasar a inserts/updates de columnas nullable.
 */
export function normalizarNombreOrNull(
  input: string | null | undefined,
): string | null {
  const v = normalizarNombre(input);
  return v || null;
}
