/**
 * Clasificación de clientes de sala.
 *
 * POR QUÉ existe: hasta ahora `clientes_sala.clasificacion` era un texto que
 * alguien tenía que escribir a mano, así que en la práctica todo el mundo se
 * quedaba en NUEVO para siempre. Aquí se calcula sola a partir de las visitas
 * reales del cliente.
 *
 * REGLA: el cálculo es por VISITAS acumuladas y nada más. No hay degradación
 * por antigüedad — que alguien lleve meses sin venir no lo baja de categoría.
 *
 * NO HAY OVERRIDE MANUAL: la clasificación es siempre la calculada. Antes se
 * podía fijar a mano, y el resultado era que la etiqueta dependía de quién
 * hubiera tocado la ficha por última vez en vez de decir lo mismo para todos.
 * La columna `clasificacion_manual` sigue en la tabla, pero ya no se lee.
 */

import type { ClasificacionCliente } from "@/features/sala/data/clientes";

export interface UmbralesClasificacion {
  /** Visitas a partir de las cuales el cliente deja de ser NUEVO. */
  regularMin: number;
  vipMin: number;
}

/**
 * NUEVO 0-1 · REGULAR 2-4 · VIP 5+.
 *
 * La primera visita todavía es NUEVO: alguien que ha venido una sola vez no es
 * aún un cliente de la casa.
 */
export const UMBRALES_CLASIFICACION_DEFAULT: UmbralesClasificacion = {
  regularMin: 2,
  vipMin: 5,
};

/**
 * Clasificación que le corresponde a un cliente por sus visitas.
 *
 * Con 0 visitas devuelve NUEVO: aún no ha venido, pero tiene ficha (viene de
 * una reserva futura).
 */
export function calcularClasificacion(
  visitas: number,
  umbrales: UmbralesClasificacion = UMBRALES_CLASIFICACION_DEFAULT,
): ClasificacionCliente {
  const v = Number.isFinite(visitas) ? Math.max(0, Math.trunc(visitas)) : 0;
  if (v >= umbrales.vipMin) return "VIP";
  if (v >= umbrales.regularMin) return "REGULAR";
  return "NUEVO";
}

/**
 * Clasificación efectiva. Es la única función que debe usar la UI para pintar
 * el badge, así no hay dos criterios distintos según la pantalla.
 *
 * Se mantiene como envoltorio de `calcularClasificacion` (en vez de que cada
 * pantalla la llame) porque es el punto único donde vive la regla: si algún día
 * vuelve a haber excepciones, se añaden aquí y no en cinco sitios.
 */
export function clasificacionEfectiva(input: {
  visitas: number;
  umbrales?: UmbralesClasificacion;
}): ClasificacionCliente {
  return calcularClasificacion(input.visitas, input.umbrales);
}

/**
 * Normaliza los umbrales leídos de configuración, protegiendo el orden.
 *
 * Si alguien configura vip < regular, el cálculo daría saltos absurdos. Se
 * fuerza que cada escalón sea al menos tan alto como el anterior.
 */
export function normalizarUmbrales(input: {
  regularMin?: number | null;
  vipMin?: number | null;
}): UmbralesClasificacion {
  const d = UMBRALES_CLASIFICACION_DEFAULT;
  const regularMin = Math.max(1, Math.trunc(input.regularMin ?? d.regularMin));
  const vipMin = Math.max(regularMin, Math.trunc(input.vipMin ?? d.vipMin));
  return { regularMin, vipMin };
}
