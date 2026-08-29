/**
 * Meses de las nóminas y de los seguros sociales.
 *
 * Un mes es siempre 'AAAA-MM'. Se opera partiendo la cadena, nunca con `Date`,
 * para que ninguna zona horaria pueda desplazar el mes.
 */

/** ¿Es un periodo válido 'AAAA-MM'? */
export function esPeriodoValido(periodo: string | null | undefined): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo ?? "");
}

/**
 * Mes anterior a uno dado: '2026-08' → '2026-07', '2026-01' → '2025-12'.
 *
 * Es el que se propone por defecto para los seguros sociales, porque la
 * Seguridad Social se liquida a mes VENCIDO: con las nóminas de agosto llega
 * el TC1 de julio.
 */
export function mesAnterior(periodo: string): string {
  if (!esPeriodoValido(periodo)) return periodo;
  const [y, m] = periodo.split("-").map(Number);
  const anio = m === 1 ? y - 1 : y;
  const mes = m === 1 ? 12 : m - 1;
  return `${anio}-${String(mes).padStart(2, "0")}`;
}
