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
 * INACTIVO existe solo como marca MANUAL, nunca se asigna automáticamente.
 *
 * El override manual manda: si una persona fija la clasificación a mano
 * (`clasificacion_manual = true`), el cálculo no la pisa. Un cliente puede ser
 * VIP porque es crítico gastronómico, no porque haya venido diez veces.
 */

import type { ClasificacionCliente } from "@/features/sala/data/clientes";

export interface UmbralesClasificacion {
  /** Visitas a partir de las cuales el cliente deja de ser NUEVO. */
  regularMin: number;
  frecuenteMin: number;
  vipMin: number;
}

export const UMBRALES_CLASIFICACION_DEFAULT: UmbralesClasificacion = {
  regularMin: 2,
  frecuenteMin: 5,
  vipMin: 10,
};

/**
 * Clasificación que le corresponde a un cliente por sus visitas.
 *
 * Con 0 visitas devuelve NUEVO: aún no ha venido, pero tiene ficha (viene de
 * una reserva futura). Nunca devuelve INACTIVO — eso es decisión humana.
 */
export function calcularClasificacion(
  visitas: number,
  umbrales: UmbralesClasificacion = UMBRALES_CLASIFICACION_DEFAULT,
): ClasificacionCliente {
  const v = Number.isFinite(visitas) ? Math.max(0, Math.trunc(visitas)) : 0;
  if (v >= umbrales.vipMin) return "VIP";
  if (v >= umbrales.frecuenteMin) return "FRECUENTE";
  if (v >= umbrales.regularMin) return "REGULAR";
  return "NUEVO";
}

/**
 * Clasificación efectiva: la manual si la hay, si no la calculada.
 *
 * Es la única función que debe usar la UI para pintar el badge, así no hay dos
 * criterios distintos según la pantalla.
 */
export function clasificacionEfectiva(input: {
  clasificacion: ClasificacionCliente;
  clasificacionManual: boolean;
  visitas: number;
  umbrales?: UmbralesClasificacion;
}): ClasificacionCliente {
  if (input.clasificacionManual) return input.clasificacion;
  return calcularClasificacion(input.visitas, input.umbrales);
}

/**
 * Normaliza los umbrales leídos de configuración, protegiendo el orden.
 *
 * Si alguien configura vip < frecuente, el cálculo daría saltos absurdos
 * (11 visitas = FRECUENTE y 10 = VIP). Se fuerza que cada escalón sea al menos
 * tan alto como el anterior.
 */
export function normalizarUmbrales(input: {
  regularMin?: number | null;
  frecuenteMin?: number | null;
  vipMin?: number | null;
}): UmbralesClasificacion {
  const d = UMBRALES_CLASIFICACION_DEFAULT;
  const regularMin = Math.max(1, Math.trunc(input.regularMin ?? d.regularMin));
  const frecuenteMin = Math.max(
    regularMin,
    Math.trunc(input.frecuenteMin ?? d.frecuenteMin),
  );
  const vipMin = Math.max(frecuenteMin, Math.trunc(input.vipMin ?? d.vipMin));
  return { regularMin, frecuenteMin, vipMin };
}
