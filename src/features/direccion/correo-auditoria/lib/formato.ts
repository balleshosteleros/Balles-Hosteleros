/**
 * Formato de números del panel de correo (PRP-094).
 *
 * Coma decimal y punto de millar, como en el resto del software: «12,4» y
 * «1.284», nunca «12.4» ni «1,284».
 */

export function formatoNumero(valor: number): string {
  return valor.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

/** Porcentaje con un decimal: «14,5 %». */
export function formatoPorcentaje(valor: number): string {
  return `${valor.toLocaleString("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

/** aaaa-mm-dd → dd/mm, para los ejes de la gráfica. */
export function diaCorto(fecha: string): string {
  const [, mes, dia] = fecha.split("-");
  return `${dia}/${mes}`;
}
