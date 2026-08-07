/**
 * Completa el destino que escribe la persona.
 *
 * Nadie escribe `https://` al teclear una dirección: se escribe `google.com` o se
 * pega algo copiado del navegador. Exigir el prefijo era una pega mía, no del
 * usuario, así que se pone por detrás.
 *
 * Vive en `lib/` (sin "server-only") porque la usan LAS DOS partes: el formulario
 * al validar y la server action al guardar. Si cada lado tuviera su propia regla,
 * acabarían discrepando y algo pasaría la validación pero no el guardado.
 */

/** Esquemas que NO se completan: o ya son válidos, o no deben aceptarse nunca. */
const TIENE_ESQUEMA = /^[a-z][a-z0-9+.-]*:/i;

export function normalizarDestino(raw: string): string {
  const v = raw.trim();
  if (!v) return "";

  // `//ejemplo.com` (heredado de webs antiguas) → https.
  if (v.startsWith("//")) return `https:${v}`;

  // Ya trae esquema (https:, http:, mailto:, javascript:…): se respeta tal cual y
  // que decida la validación. Completar aquí un `javascript:` lo disfrazaría de
  // dirección buena.
  if (TIENE_ESQUEMA.test(v)) return v;

  return `https://${v}`;
}

/**
 * ¿Es un destino que podemos servir? Solo http/https: sin esto, el gestor sería un
 * redirector abierto y alguien con acceso al panel podría apuntar un QR a
 * `javascript:` y usarlo contra los clientes del restaurante.
 */
export function destinoValido(raw: string): boolean {
  try {
    const u = new URL(normalizarDestino(raw));
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // `https://` a secas construye una URL sin dominio: no lleva a ninguna parte.
    return u.hostname.includes(".") && !u.hostname.startsWith(".") && !u.hostname.endsWith(".");
  } catch {
    return false;
  }
}
