/**
 * Validación de direcciones de correo del compositor.
 *
 * Fuente ÚNICA: la usan el campo "Para" (aviso inline), el botón de enviar y el
 * endpoint del servidor. Si la regla viviera duplicada, el aviso de la pantalla
 * y el del servidor acabarían discrepando.
 */

/** Forma mínima de una dirección: algo@algo.tld */
const RE_EMAIL = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/;

/** Valida una dirección suelta. Admite el formato "Nombre <correo@dominio>". */
export function esDireccionValida(direccion: string): boolean {
  const d = direccion.trim();
  if (!d) return false;
  const m = d.match(/<([^>]+)>\s*$/);
  return RE_EMAIL.test(m ? m[1].trim() : d);
}

/**
 * Direcciones mal escritas de una lista separada por comas o punto y coma.
 * Devolver la lista (y no un booleano) permite decir CUÁL falla.
 */
export function direccionesInvalidas(lista: string): string[] {
  return lista
    .split(/[,;]/)
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .filter((d) => !esDireccionValida(d));
}
