/**
 * Código de Cuenta de Cotización de la Seguridad Social.
 *
 * Son SIEMPRE 11 dígitos, ni uno más ni uno menos:
 *
 *     28  2556275  28
 *     ──  ───────  ──
 *      │      │     └─ dígitos de control
 *      │      └─ número de la cuenta
 *      └─ provincia
 *
 * Los dos de control se calculan con los nueve anteriores módulo 97, así que
 * un número mal copiado se detecta sin llamar a nadie. Se comprueba aquí y en
 * el servidor: este número viaja en cada alta que se manda a la gestoría, y un
 * dígito cambiado da de alta al trabajador en la cuenta de otra empresa.
 */

export const CCC_LONGITUD = 11;

/** Se queda solo con los dígitos y recorta a 11: la gente lo pega con espacios. */
export function normalizarCcc(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, CCC_LONGITUD);
}

/** Lo parte en provincia · número · control para leerlo de un vistazo. */
export function formatearCcc(ccc: string): string {
  const d = normalizarCcc(ccc);
  if (d.length !== CCC_LONGITUD) return d;
  return `${d.slice(0, 2)} ${d.slice(2, 9)} ${d.slice(9)}`;
}

/** Si los dos últimos dígitos cuadran con los nueve anteriores módulo 97. */
export function controlCccCorrecto(ccc: string): boolean {
  const d = normalizarCcc(ccc);
  if (d.length !== CCC_LONGITUD) return false;
  return Number(d.slice(0, 9)) % 97 === Number(d.slice(9));
}

/**
 * Qué está mal, en una frase, o null si está bien. Vacío también es válido:
 * el CCC se puede rellenar más tarde, lo que no se admite es uno a medias.
 */
export function errorCcc(ccc: string): string | null {
  const d = normalizarCcc(ccc);
  if (!d) return null;
  if (d.length < CCC_LONGITUD) {
    return `Faltan ${CCC_LONGITUD - d.length} dígitos: el CCC tiene ${CCC_LONGITUD}.`;
  }
  if (!controlCccCorrecto(d)) {
    return "Los dos últimos dígitos no cuadran con el resto. Revísalo.";
  }
  return null;
}
