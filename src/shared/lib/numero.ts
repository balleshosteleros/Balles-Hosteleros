/**
 * Formato numérico canónico del software — convención es-ES.
 *
 * NORMA OBLIGATORIA: separador decimal = coma (,), separador de miles = punto (.).
 * Ejemplo: mil doscientos treinta y cuatro con cincuenta → "1.234,50".
 *
 * Úsalo SIEMPRE para mostrar y parsear números (precios, cantidades, %, sumatorios).
 * No reinventes `eur()`/`fmt()` por componente: importa desde aquí.
 */

/**
 * Convierte la entrada del usuario (es-ES) a número JS.
 *
 * Tolera: símbolos de moneda, espacios, separador de miles con punto y decimal
 * con coma. También acepta entrada "informática" (punto decimal) cuando no hay
 * ambigüedad, para no romper datos pegados o de importación.
 *
 * Reglas:
 *  - "1.234,50"  → 1234.5  (punto = miles, coma = decimal)
 *  - "12,50"     → 12.5
 *  - "1.234"     → 1234    (un único punto con 3 decimales = miles)
 *  - "12.50"     → 12.5    (un único punto, no parece miles → decimal)
 *  - "1.234.567" → 1234567 (varios puntos = miles)
 *
 * Devuelve null si no hay número válido (cadena vacía, texto, etc.).
 */
export function parseDecimal(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;

  let s = String(val).trim();
  if (s === "") return null;

  // Quitar moneda, espacios y separadores de miles "raros".
  s = s.replace(/[€$£\s ]/g, "");
  // Signo
  const negativo = /^-/.test(s);
  s = s.replace(/[^0-9.,]/g, "");
  if (s === "") return null;

  const tieneComa = s.includes(",");
  const tienePunto = s.includes(".");

  if (tieneComa && tienePunto) {
    // El separador que aparece más a la derecha es el decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // coma decimal → quitar puntos (miles), coma → punto
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // punto decimal → quitar comas (miles)
      s = s.replace(/,/g, "");
    }
  } else if (tieneComa) {
    // Solo coma → decimal es-ES
    s = s.replace(",", ".");
  } else if (tienePunto) {
    const partes = s.split(".");
    if (partes.length > 2) {
      // Varios puntos → todos son miles
      s = partes.join("");
    } else {
      const decimales = partes[1] ?? "";
      // Un único punto con exactamente 3 decimales y parte entera = miles.
      if (decimales.length === 3 && partes[0].length >= 1) {
        s = partes.join("");
      }
      // En cualquier otro caso lo dejamos como decimal (p. ej. "12.50").
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -Math.abs(n) : n;
}

/** Igual que parseDecimal pero devuelve 0 en vez de null (útil en sumatorios). */
export function parseDecimalOr0(val: unknown): number {
  return parseDecimal(val) ?? 0;
}

type NumOpts = { min?: number; max?: number };

/**
 * Formatea un número con convención es-ES (coma decimal, punto de miles).
 * Por defecto sin forzar decimales (0–2). Pasa null/NaN → "".
 */
export function formatNumero(n: number | null | undefined, opts: NumOpts = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: opts.min ?? 0,
    maximumFractionDigits: opts.max ?? 2,
  });
}

/**
 * Formatea un importe en euros: "1.234,50 €". 2 decimales fijos por defecto.
 * Permite ampliar a más decimales (p. ej. precios de compra a 4) con `max`.
 */
export function formatEur(
  n: number | null | undefined,
  opts: NumOpts = {},
): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.min ?? 2,
    maximumFractionDigits: opts.max ?? 2,
  });
}

/** Porcentaje es-ES: formatPorcentaje(21) → "21 %"; respeta decimales si los hay. */
export function formatPorcentaje(
  n: number | null | undefined,
  opts: NumOpts = {},
): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  const num = n.toLocaleString("es-ES", {
    minimumFractionDigits: opts.min ?? 0,
    maximumFractionDigits: opts.max ?? 2,
  });
  return `${num} %`;
}
