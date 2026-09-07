/**
 * El marcador de reputación: nota media, reparto de estrellas y estado de las
 * respuestas del conjunto de valoraciones que se está viendo.
 *
 * Se calcula sobre las filas YA filtradas de la lista, no sobre el histórico
 * entero. Es lo que hace que el marcador conteste a lo que se está preguntando:
 * si filtras por Google enseña la nota de Google, y si marcas Google y encuesta,
 * la de las dos juntas. Un resumen fijo mientras la lista cambia debajo no
 * informa de nada.
 *
 * La nota de cada valoración sale de `notaValoracion`, el mismo cálculo que usa
 * la lista, la ficha del cliente y la gráfica: media de las tres preguntas
 * cuando el cliente las contestó, y si no, la nota global. Duplicarlo aquí
 * habría hecho que la misma valoración pesara distinto en el marcador que en la
 * fila de al lado.
 */

import { notaValoracion } from "@/features/sala/lib/clasificacion-cliente";
import {
  ESTADOS_SIN_VALORACION,
  type OrigenResena,
  type Resena,
} from "@/features/calidad/types/resenas";

/** Las estrellas del reparto, de más a menos, como se pintan. */
export const ESTRELLAS_REPARTO = [5, 4, 3, 2, 1] as const;

/**
 * Plataformas públicas: aquellas en las que la respuesta se publica de cara a
 * todo el mundo y por tanto tiene sentido contar cuántas quedan sin contestar.
 * Una encuesta interna o el correo posterior a la visita no se "responden" en
 * ningún sitio público, así que contarlas como pendientes daría una cifra falsa.
 */
const ORIGENES_PUBLICOS: OrigenResena[] = ["google"];

export interface ResumenResenas {
  /** Valoraciones del filtro que traen nota (las que forman la media). */
  conNota: number;
  /** Todas las filas del filtro, tengan nota o no. */
  totalFilas: number;
  /** Nota media de 1 a 5, o null si ninguna tenía nota. */
  notaMedia: number | null;
  /** Cuántas hay de cada estrella, redondeando la nota. */
  reparto: Record<number, number>;
  /** Valoraciones de plataformas públicas dentro del filtro. */
  publicas: number;
  respondidas: number;
  sinResponder: number;
  /**
   * Días de media entre la valoración y su respuesta publicada. Null cuando
   * todavía no hay ninguna respuesta con fecha: un cero diría que se contesta
   * el mismo día, que es lo contrario de "no lo sabemos".
   */
  diasMediaRespuesta: number | null;
}

const VACIO: ResumenResenas = {
  conNota: 0,
  totalFilas: 0,
  notaMedia: null,
  reparto: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  publicas: 0,
  respondidas: 0,
  sinResponder: 0,
  diasMediaRespuesta: null,
};

/** Una valoración es pública si se publicó en una ficha que ve cualquiera. */
export function esResenaPublica(r: Resena): boolean {
  return ORIGENES_PUBLICOS.includes(r.origen);
}

/** Ya tiene respuesta, la haya escrito una persona o la haya publicado la IA. */
function estaRespondida(r: Resena): boolean {
  return (
    r.respondida ||
    !!r.respuesta_publicada_at ||
    !!(r.respuesta_propietario && r.respuesta_propietario.trim())
  );
}

export function calcularResumenResenas(resenas: Resena[]): ResumenResenas {
  if (resenas.length === 0) return { ...VACIO, reparto: { ...VACIO.reparto } };

  const reparto: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let suma = 0;
  let conNota = 0;
  let publicas = 0;
  let respondidas = 0;
  let sumaDias = 0;
  let conFechaRespuesta = 0;

  for (const r of resenas) {
    // "Nuevo comensal" es la cola de trabajo de calidad, no una opinión: no
    // puntúa nada y hundiría el reparto con filas en blanco.
    const esValoracion = !ESTADOS_SIN_VALORACION.includes(r.estado);
    const nota = esValoracion
      ? notaValoracion({
          rating: r.rating,
          comida: r.rating_comida,
          servicio: r.rating_servicio,
          ambiente: r.rating_ambiente,
        })
      : null;

    if (nota !== null) {
      suma += nota;
      conNota += 1;
      const estrella = Math.min(5, Math.max(1, Math.round(nota)));
      reparto[estrella] += 1;
    }

    if (!esResenaPublica(r)) continue;
    publicas += 1;
    if (!estaRespondida(r)) continue;
    respondidas += 1;

    const desde = r.fecha_reseña;
    const hasta = r.respuesta_publicada_at;
    if (!desde || !hasta) continue;
    const dias =
      (new Date(hasta).getTime() - new Date(desde).getTime()) / 86_400_000;
    // Una respuesta fechada antes que la reseña es un dato roto de la
    // importación, no una respuesta instantánea: fuera de la media.
    if (!Number.isFinite(dias) || dias < 0) continue;
    sumaDias += dias;
    conFechaRespuesta += 1;
  }

  return {
    conNota,
    totalFilas: resenas.length,
    notaMedia: conNota > 0 ? suma / conNota : null,
    reparto,
    publicas,
    respondidas,
    sinResponder: publicas - respondidas,
    diasMediaRespuesta:
      conFechaRespuesta > 0 ? sumaDias / conFechaRespuesta : null,
  };
}
