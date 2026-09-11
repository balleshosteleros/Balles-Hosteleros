/**
 * Color de los cuadraditos del móvil (Mis paneles, Mis departamentos y los
 * submódulos de cada departamento).
 *
 * El color ya no lo elige cada acceso: lo marca su SITIO en la rejilla. La
 * primera fila arranca en el azul de marca y cada fila de 3 sube un paso hacia
 * el violeta, así que la pantalla entera se lee como un degradado de arriba
 * abajo en vez de como cuadros sueltos de colores distintos (Iván, 11-sep).
 *
 * El degradado se REPARTE entre las filas que haya: una rejilla de 4 filas y
 * otra de 6 recorren el mismo camino de azul a violeta, sin que una se quede a
 * medias. Con una sola fila, el azul de partida.
 */

/** Azul de marca: donde arranca la primera fila. */
const HUE_INICIO = 211;
/** Violeta: donde acaba la última fila. */
const HUE_FIN = 252;
/** Columnas de la rejilla en el teléfono. El color sube de 3 en 3. */
export const COLUMNAS_MOVIL = 3;

/**
 * Tono del cuadradito que ocupa la posición `indice` dentro de una rejilla de
 * `total` cuadraditos.
 */
export function hueDeTile(indice: number, total: number): number {
  const filas = Math.ceil(Math.max(total, 1) / COLUMNAS_MOVIL);
  if (filas <= 1) return HUE_INICIO;
  const fila = Math.floor(indice / COLUMNAS_MOVIL);
  return Math.round(HUE_INICIO + ((HUE_FIN - HUE_INICIO) * fila) / (filas - 1));
}
