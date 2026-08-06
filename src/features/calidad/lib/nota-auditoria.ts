/**
 * Cálculo de la nota de una auditoría. Fuente ÚNICA: lo usan tanto la pantalla
 * de rellenado (nota provisional) como el servidor al cerrar, para que no
 * puedan dar resultados distintos.
 *
 * ESCALA DE ESTRELLAS 1..5, como las de Google: la peor valoración es 1
 * estrella y no existe el 0. Cada estrella vale un 20 %:
 *
 *     1★ = 2,0    2★ = 4,0    3★ = 6,0    4★ = 8,0    5★ = 10,0
 *
 * Y cada PREGUNTA puntuable pesa lo mismo dentro del total: con 5 preguntas,
 * cada una es el 20 % de la nota final; con 60, cada una es 1/60.
 *
 * Las auditorías antiguas se rellenaron en escala 0..5 (donde 0 valía 0). No se
 * reescriben: `notaDeEscala` convierte proporcionalmente el valor que haya
 * guardado, así que una respuesta antigua con 0 sigue valiendo 0.
 */

/** Estrellas de una pregunta de escala. */
export const ESCALA_MAX = 5;

/** Convierte las estrellas marcadas (1..max) en nota sobre 10. */
export function notaDeEscala(valor: number, escalaMax: number | null): number {
  const max = escalaMax && escalaMax > 0 ? escalaMax : ESCALA_MAX;
  return (valor / max) * 10;
}

/** Una respuesta puntuable: solo las de escala suman a la nota. */
export interface RespuestaPuntuable {
  tipo: string;
  escala_max: number | null;
  peso: number;
  valor_numero: number | null;
}

/**
 * Nota final sobre 10, o null si no hay ninguna escala contestada.
 *
 * Las preguntas de texto y observaciones no puntúan (su peso es 0), pero eso no
 * las exime de contestarse: de eso se encarga la validación de cierre.
 */
export function calcularNota(respuestas: RespuestaPuntuable[]): number | null {
  let suma = 0;
  let pesos = 0;
  for (const r of respuestas) {
    if (r.tipo !== "escala" || r.valor_numero === null) continue;
    const peso = r.peso > 0 ? r.peso : 1;
    suma += notaDeEscala(r.valor_numero, r.escala_max) * peso;
    pesos += peso;
  }
  return pesos === 0 ? null : Number((suma / pesos).toFixed(2));
}
