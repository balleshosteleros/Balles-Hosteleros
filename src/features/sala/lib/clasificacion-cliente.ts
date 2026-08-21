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

/** Lo mínimo que hace falta para puntuar una valoración. */
export interface PuntuableValoracion {
  rating: number | null;
  comida: number | null;
  servicio: number | null;
  ambiente: number | null;
}

/**
 * Nota de UNA valoración: media de comida, servicio y ambiente.
 *
 * Promedia solo las categorías PUNTUADAS. Contar una categoría en blanco como
 * cero hundiría la nota de quien puso dos cincos y dejó la tercera sin tocar.
 * Si no puntuó ninguna, cae a `rating`, que es lo que manda el QR de la carta
 * (allí solo hay una estrella global, sin desglose).
 *
 * Vive aquí, y no en la pantalla, porque la nota de cada valoración y la media
 * global del cliente tienen que salir del MISMO cálculo. Estaban duplicadas y
 * no coincidían: la ficha promediaba el desglose y la lista usaba `rating`, así
 * que el mismo cliente podía enseñar dos notas distintas según dónde se mirara.
 */
export function notaValoracion(r: PuntuableValoracion | null): number | null {
  if (!r) return null;
  const notas = [r.comida, r.servicio, r.ambiente].filter(
    (n): n is number => typeof n === "number",
  );
  if (notas.length === 0) return r.rating;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

/**
 * Nota GLOBAL del cliente: media de las notas de todas sus valoraciones.
 *
 * Con una sola valoración devuelve esa misma nota. Las valoraciones sin ninguna
 * puntuación no entran en la media: son ausencia de dato, no un cero.
 */
export function notaGlobalCliente(
  valoraciones: PuntuableValoracion[],
): number | null {
  const notas = valoraciones
    .map(notaValoracion)
    .filter((n): n is number => typeof n === "number");
  if (notas.length === 0) return null;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

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
