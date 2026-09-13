/**
 * El veredicto de una valoración —Excelente, Regular o Malo— SE CALCULA.
 *
 * Antes era una columna (`resenas.estado`) que convivía con la nota, y las dos
 * contaban la misma historia por separado: en el tablero salía un 4 en la
 * columna Excelente y otro 4 en Regular, porque una se decidía por la nota
 * global y la otra por la media del desglose. Con el veredicto calculado solo
 * hay una verdad, y está aquí.
 *
 * LOS UMBRALES son los que ya se aplicaron al migrar CoverManager, comprobados
 * contra las 8.417 valoraciones con nota: cuadran en el 99,94 %.
 *
 * LA REGLA DEL ÁREA SUSPENDIDA es lo que la media sola no ve. Quien puntúa la
 * comida con un 2 y el resto con cincos saca una media de 4 y dormía en la
 * columna verde: nadie le llamaba, teniendo un problema concreto y localizado.
 * Son 17 valoraciones hoy. Un área por debajo de 3 impide el Excelente.
 */

import type { Resena } from "@/features/calidad/types/resenas";

export type Veredicto = "excelente" | "regular" | "malo";

/** Nota a partir de la cual la valoración es Excelente. */
export const UMBRAL_EXCELENTE = 4;
/** Por debajo de esto, Malo. Entre las dos, Regular. */
export const UMBRAL_REGULAR = 3;

export interface VeredictoConfig {
  label: string;
  /** Color del texto en listados. */
  color: string;
  /** Fondo de la píldora. */
  badge: string;
}

export const VEREDICTOS: Record<Veredicto, VeredictoConfig> = {
  excelente: {
    label: "Excelente",
    color: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
  regular: {
    label: "Regular",
    color: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  malo: {
    label: "Malo",
    color: "text-rose-700",
    badge: "bg-rose-100 text-rose-700",
  },
};

/** Las notas por área que trae una valoración, sin las que no puntuó. */
export function areasPuntuadas(r: Puntuable): number[] {
  return [
    r.rating_comida,
    r.rating_servicio,
    r.rating_ambiente,
    r.rating_bebida,
    r.rating_musica,
    r.rating_espectaculo,
  ].filter((n): n is number => typeof n === "number");
}

/** Lo mínimo que hace falta para juzgar una valoración. */
export type Puntuable = Pick<
  Resena,
  | "rating"
  | "rating_comida"
  | "rating_servicio"
  | "rating_ambiente"
  | "rating_bebida"
  | "rating_musica"
  | "rating_espectaculo"
>;

/**
 * La nota que MANDA: la media de lo que puntuó por áreas y, si no puntuó
 * ninguna, la global que dio de una sola vez (Google y WhatsApp solo dan esa).
 *
 * `null` = todavía no ha valorado. No es un cero.
 */
export function notaDe(r: Puntuable): number | null {
  const areas = areasPuntuadas(r);
  if (areas.length > 0) {
    return areas.reduce((a, b) => a + b, 0) / areas.length;
  }
  return r.rating ?? null;
}

/**
 * El veredicto. `null` cuando aún no ha valorado, que es distinto de Malo.
 */
export function veredictoDe(r: Puntuable): Veredicto | null {
  const nota = notaDe(r);
  if (nota === null) return null;

  if (nota < UMBRAL_REGULAR) return "malo";

  // Un área suspendida tumba el Excelente por alta que sea la media: un 2 en la
  // comida no se compensa con dos cincos, se arregla.
  const areas = areasPuntuadas(r);
  const hayAreaSuspendida = areas.some((n) => n < UMBRAL_REGULAR);

  if (nota >= UMBRAL_EXCELENTE && !hayAreaSuspendida) return "excelente";
  return "regular";
}

/** Ha valorado o no. Lo que antes distinguía la columna "Nuevo comensal". */
export function haValorado(r: Puntuable): boolean {
  return notaDe(r) !== null;
}
