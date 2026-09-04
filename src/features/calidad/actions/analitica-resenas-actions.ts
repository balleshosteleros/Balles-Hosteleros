"use server";

/**
 * Evolución mensual de las valoraciones: nota media y volumen de comentarios.
 *
 * Responde a dos preguntas que el pipeline de reseñas no puede contestar porque
 * enseña las fichas una a una: "¿estamos mejorando o empeorando?" y "¿en qué mes
 * nos dijeron más cosas?". La lista sirve para gestionar cada reseña; esto, para
 * ver la tendencia.
 *
 * La nota de cada reseña sale del MISMO cálculo que usa la ficha del cliente
 * (`notaValoracion`): media de las categorías puntuadas, y si no hay ninguna,
 * el `rating` global. Duplicar ese cálculo aquí habría hecho que la misma
 * valoración enseñara una nota en la ficha y otra en la gráfica.
 *
 * Las lee TODAS paginando: BACANAL ya tiene 2.131 reseñas y Supabase corta en
 * 1.000 filas sin avisar, así que una consulta normal habría dibujado una
 * gráfica a la que le falta más de la mitad del histórico, sin error visible.
 */

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { leerTodas } from "@/shared/lib/supabase-paginado";
import { notaValoracion } from "@/features/sala/lib/clasificacion-cliente";

/** Un mes de la serie. `mes` va como "AAAA-MM" para poder ordenar y filtrar. */
export interface MesValoraciones {
  mes: string;
  /** Nota media del mes (1-5), o null si ninguna reseña del mes tenía nota. */
  notaMedia: number | null;
  /** Cuántas valoraciones entraron ese mes. */
  total: number;
  /** Cuántas de ellas traían comentario escrito. */
  conComentario: number;
}

export interface AnaliticaResenas {
  serie: MesValoraciones[];
  /** Nota media de todo el periodo, para el encabezado. */
  notaMediaGlobal: number | null;
  total: number;
  totalConComentario: number;
}

/**
 * Serie mensual de los últimos `meses` (12 por defecto).
 *
 * Se agrupa por `fecha_reseña`, que es cuando el cliente valoró; `created_at`
 * es cuando la fila entró en el sistema y en las 2.611 traídas de CoverManager
 * son el mismo día de la importación — agrupar por ahí habría amontonado cinco
 * años de historia en un solo mes.
 */
export async function getAnaliticaResenas(
  meses = 12,
): Promise<AnaliticaResenas> {
  const vacio: AnaliticaResenas = {
    serie: [],
    notaMediaGlobal: null,
    total: 0,
    totalConComentario: 0,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return vacio;
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) return vacio;

    // Primer día del mes que abre la ventana: así el mes más antiguo sale
    // completo y no cortado por la mitad.
    const hoy = new Date();
    const desde = new Date(
      Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (meses - 1), 1),
    );

    const filas = await leerTodas<{
      rating: number | null;
      rating_comida: number | null;
      rating_servicio: number | null;
      rating_ambiente: number | null;
      comentario: string | null;
      fecha: string | null;
      created_at: string | null;
    }>(() =>
      supabase
        .from("resenas")
        .select(
          // `fecha_reseña` lleva eñe: hay que entrecomillarla y darle un alias
          // ASCII, o el parser del cliente no la reconoce.
          'rating, rating_comida, rating_servicio, rating_ambiente, comentario, created_at, fecha:"fecha_reseña"',
        )
        .eq("empresa_id", empresaId),
    );

    // Un mapa por clave "AAAA-MM" y luego se rellenan los meses sin datos: sin
    // eso, un mes sin ninguna valoración desaparecía del eje y la línea unía
    // dos meses no consecutivos como si fueran seguidos.
    const acc = new Map<string, { suma: number; conNota: number; total: number; conComentario: number }>();

    for (const r of filas) {
      const iso = r.fecha ?? r.created_at;
      if (!iso) continue;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime()) || d < desde) continue;

      const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const actual = acc.get(clave) ?? { suma: 0, conNota: 0, total: 0, conComentario: 0 };

      const nota = notaValoracion({
        rating: r.rating,
        comida: r.rating_comida,
        servicio: r.rating_servicio,
        ambiente: r.rating_ambiente,
      });
      if (nota !== null) {
        actual.suma += nota;
        actual.conNota += 1;
      }
      actual.total += 1;
      if (r.comentario && r.comentario.trim().length > 0) actual.conComentario += 1;
      acc.set(clave, actual);
    }

    const serie: MesValoraciones[] = [];
    for (let i = 0; i < meses; i++) {
      const d = new Date(
        Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + i, 1),
      );
      const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const v = acc.get(clave);
      serie.push({
        mes: clave,
        notaMedia: v && v.conNota > 0 ? v.suma / v.conNota : null,
        total: v?.total ?? 0,
        conComentario: v?.conComentario ?? 0,
      });
    }

    // La media global se calcula sobre las valoraciones, no promediando las
    // medias mensuales: un mes con 2 reseñas pesaría lo mismo que otro con 50.
    let suma = 0;
    let conNota = 0;
    let total = 0;
    let totalConComentario = 0;
    for (const m of serie) {
      total += m.total;
      totalConComentario += m.conComentario;
      if (m.notaMedia !== null) {
        const nConNota = acc.get(m.mes)?.conNota ?? 0;
        suma += m.notaMedia * nConNota;
        conNota += nConNota;
      }
    }

    return {
      serie,
      notaMediaGlobal: conNota > 0 ? suma / conNota : null,
      total,
      totalConComentario,
    };
  } catch (err) {
    console.error("[calidad] getAnaliticaResenas:", err);
    return vacio;
  }
}
