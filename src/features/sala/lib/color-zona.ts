/**
 * Color de fondo de las zonas de sala según el tema activo.
 *
 * Vive aquí, fuera de cualquier vista, porque lo usan a la vez el plano de
 * Reservas, sus etiquetas de zona, el listado agrupado y el salón de la
 * reasignación manual de mesas. Es el ÚNICO punto donde se decide ese color:
 * si cada pantalla lo calculara por su cuenta, la misma zona se vería de un
 * color distinto según desde dónde se mirara.
 */

/**
 * Mezcla un hex con blanco para suavizar los pasteles de zona.
 * ratio 0 = original, 1 = blanco. Tolerante a entradas mal formateadas.
 */
export function lightenHex(hex: string, ratio: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, "0")}`;
}

/**
 * Versión oscura de un pastel de zona.
 *
 * No se puede mezclar el hex con azul marino en RGB: los amarillos y naranjas
 * salían marrones. Se trabaja en HSL para CONSERVAR el matiz de la zona (lo que
 * la identifica de un vistazo) y bajar solo luminosidad y saturación, de modo
 * que el amarillo siga leyéndose como amarillo, pero apagado.
 */
export function zonaOscura(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  // Matiz intacto; saturación contenida y luminosidad baja para que la mesa
  // libre sea una superficie tintada sobre el lienzo, no un bloque de color.
  const satOut = Math.min(sat, 0.42) * 100;
  const lumOut = 26;
  return `hsl(${h.toFixed(0)} ${satOut.toFixed(0)}% ${lumOut}%)`;
}

/** Cuánto aclaramos los pasteles de zona (tirando a blanco, sutil). */
export const ZONA_LIGHTEN = 0.35;

/**
 * Color de fondo de una zona según el tema activo: aclarado hacia blanco en
 * claro, mezclado con azul marino en oscuro.
 */
export function colorZona(hex: string, esOscuro: boolean): string {
  return esOscuro ? zonaOscura(hex) : lightenHex(hex, ZONA_LIGHTEN);
}
