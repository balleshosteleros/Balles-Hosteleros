/**
 * Qué se sortea cada mes en cada restaurante.
 *
 * No es lo mismo en los dos, y tiene sentido: en BACANAL se cena, y en HABANA lo
 * que se hace es beber cócteles. Sortear cenas en una coctelería sería regalar
 * algo que no es lo suyo.
 *
 * Tres plazas en ambos, para los tres primeros que acierten las cinco preguntas
 * del correo del mes.
 *
 * Se busca por el NOMBRE de la empresa y no por su id porque estos textos los
 * lee gente, no una máquina: quien abra este fichero dentro de un año tiene que
 * poder ver de un vistazo qué se regala en cada casa. Una empresa nueva sin
 * premio propio cae en el genérico en vez de romper el correo.
 */

export interface PremioMensual {
  /** Lo que se lleva UNO de los ganadores, en minúscula y sin artículo. */
  singular: string;
  /** Las tres plazas juntas, para la frase del correo de bienvenida. */
  plural: string;
}

const PREMIO_GENERICO: PremioMensual = {
  singular: "una invitación para dos",
  plural: "tres invitaciones para dos",
};

const POR_EMPRESA: Record<string, PremioMensual> = {
  BACANAL: {
    singular: "una cena para dos",
    plural: "tres cenas para dos",
  },
  HABANA: {
    singular: "una cata de cócteles para dos",
    plural: "tres catas de cócteles para dos",
  },
};

/** Las plazas del sorteo. Las mismas en las dos casas. */
export const PLAZAS_SORTEO = 3;

export function premioMensualDe(empresaNombre: string | null | undefined): PremioMensual {
  const clave = (empresaNombre ?? "").trim().toUpperCase();
  return POR_EMPRESA[clave] ?? PREMIO_GENERICO;
}
