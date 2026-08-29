/**
 * Normalizador de unidades de escandallo (PRP-080 Fase 3, DECISIÓN 3).
 *
 * REGLA MADRE: **la unidad la manda el producto.** Si una línea de escandallo está
 * vinculada a un producto, su unidad es la `medida` de ese producto — punto. El texto
 * que venga del Excel, del navegador o de un import se ignora. Solo cuando NO hay
 * producto (ingrediente aún propuesto) se cae al texto libre, y aun así homogeneizado.
 *
 * Por qué aquí y no en cada sitio: había tres rutas de importación copiando la grafía
 * literal del origen (`"Gr"`, `"GR"`, `"g"`, `"Uni"`…) y sembrando defaults sueltos
 * (`|| "ud"`, `?? "g"`). Nueve grafías para tres unidades. Centralizado, una sola verdad.
 *
 * Nota de dimensiones: masa y cuenta NO son convertibles entre sí sin saber el peso por
 * unidad (200 g de algo que se compra "por unidad" no es 0,2 unidades). Por eso el
 * normalizador NO inventa conversiones cruzadas: para eso está la revisión humana.
 */

export type Dimension = "masa" | "cuenta" | "volumen" | null;

interface UnidadInfo {
  dim: Dimension;
  base: "g" | "kg" | "ud" | "ml" | "cl" | "l" | null;
}

/** Forma canónica larga que usa `productos.medida` / la tabla `medidas`. */
export const MEDIDA_CANONICA = {
  masa: "Kilogramos",
  cuenta: "Unidades",
  volumen: "Litros",
} as const;

const SINONIMOS: Record<string, UnidadInfo> = {};
function reg(dim: Dimension, base: UnidadInfo["base"], ...formas: string[]) {
  for (const f of formas) SINONIMOS[f.toLowerCase()] = { dim, base };
}
reg("masa", "g", "g", "gr", "grs", "gramo", "gramos");
reg("masa", "kg", "kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos");
reg("cuenta", "ud", "ud", "u", "uni", "und", "unid", "unidad", "unidades", "pax", "pcs", "docena", "caja");
reg("volumen", "l", "l", "lt", "lts", "litro", "litros");
reg("volumen", "cl", "cl");
reg("volumen", "ml", "ml");

/** Descompone un texto de unidad en {dimensión, base}. `dim=null` si no se reconoce. */
export function clasificarUnidad(texto: string | null | undefined): UnidadInfo {
  const s = String(texto ?? "").trim().toLowerCase();
  return SINONIMOS[s] ?? { dim: null, base: null };
}

export function dimensionDeUnidad(texto: string | null | undefined): Dimension {
  return clasificarUnidad(texto).dim;
}

/** ¿Son la misma unidad tras homogeneizar la grafía? (g y "Gr" sí; g y kg no). */
export function mismaBase(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = clasificarUnidad(a);
  const cb = clasificarUnidad(b);
  return ca.base != null && ca.base === cb.base;
}

/** ¿La unidad de la línea y la medida del producto son de la misma dimensión? */
export function dimensionCompatible(unidadLinea: string | null | undefined, medidaProducto: string | null | undefined): boolean {
  const a = dimensionDeUnidad(unidadLinea);
  const b = dimensionDeUnidad(medidaProducto);
  return a != null && a === b;
}

/**
 * Factor para pasar una cantidad de `unidadLinea` a `medidaProducto` DENTRO de la misma
 * dimensión (g→Kg = 0,001). Devuelve `null` si no son convertibles mecánicamente
 * (dimensiones distintas o unidad no reconocida): eso es decisión humana, no se inventa.
 */
export function factorAMedida(unidadLinea: string | null | undefined, medidaProducto: string | null | undefined): number | null {
  const a = clasificarUnidad(unidadLinea);
  const b = clasificarUnidad(medidaProducto);
  if (!a.dim || a.dim !== b.dim || !a.base || !b.base) return null;
  if (a.dim === "masa") {
    const enG: Record<string, number> = { g: 1, kg: 1000 };
    return enG[a.base] / (b.base === "kg" ? 1000 : 1);
  }
  if (a.dim === "volumen") {
    const enMl: Record<string, number> = { ml: 1, cl: 10, l: 1000 };
    return enMl[a.base] / (b.base === "l" ? 1000 : b.base === "cl" ? 10 : 1);
  }
  return 1; // cuenta → cuenta
}

/**
 * Unidad definitiva de una línea de escandallo.
 *  - Con producto vinculado → su `medida`, siempre (la unidad la manda el producto).
 *  - Sin producto → texto libre homogeneizado a la forma canónica; si no se reconoce,
 *    el default indicado (por dominio: ingredientes de compra suelen ser Kg).
 */
export function unidadDeIngrediente(
  medidaProducto: string | null | undefined,
  textoLibre: string | null | undefined,
  defaultMedida: string = MEDIDA_CANONICA.masa,
): string {
  const m = String(medidaProducto ?? "").trim();
  if (m) return m;
  const info = clasificarUnidad(textoLibre);
  if (info.dim) return MEDIDA_CANONICA[info.dim];
  return defaultMedida;
}

/**
 * Unidad a ESCRIBIR al guardar una línea que YA existe (editor principal). Como la
 * `cantidad` ya está en alguna unidad, no se puede pisar la etiqueta a ciegas:
 *  - sin producto → homogeneiza el texto libre.
 *  - con producto y unidad compatible (misma base, o entrante vacía) → la medida del
 *    producto (la unidad la manda el producto).
 *  - con producto pero unidad INCOMPATIBLE (gramos vs Unidades…) → **se conserva la
 *    entrante**. Reetiquetar aquí convertiría "150 Gr" en "150 Unidades" en silencio.
 *    Se queda marcada para que una persona ajuste cantidad y unidad juntas.
 */
export function unidadAlGuardar(
  medidaProducto: string | null | undefined,
  unidadEntrante: string | null | undefined,
): string {
  const m = String(medidaProducto ?? "").trim();
  const u = String(unidadEntrante ?? "").trim();
  if (!m) return unidadDeIngrediente(null, u);
  if (!u || mismaBase(u, m)) return m;
  return u; // incompatible: no se pisa, sigue marcada para revisar
}
