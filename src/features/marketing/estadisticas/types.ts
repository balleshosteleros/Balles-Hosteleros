/**
 * Tipos compartidos por las dos gráficas de Marketing: escaneos de QR y visitas
 * de páginas web. Los datos tienen exactamente la misma forma, así que la
 * gráfica es una sola y se alimenta con cualquiera de las dos fuentes.
 */

/** Un día de la gráfica. `fecha` en ISO (aaaa-mm-dd); el formato de pantalla se
 *  decide al pintar, no aquí. */
export interface PuntoSerie {
  fecha: string;
  total: number;
}

export interface RepartoDispositivo {
  movil: number;
  tablet: number;
  escritorio: number;
  otro: number;
}

export interface SerieEstadisticas {
  /** Un punto por día del periodo, incluidos los días sin nada (total 0). Sin
   *  rellenar los huecos la línea uniría dos fechas lejanas y aparentaría una
   *  actividad continua que no existió. */
  serie: PuntoSerie[];
  /** Suma del periodo mostrado, no el total histórico. */
  total: number;
  /** Media diaria del periodo, para el subtítulo. */
  media: number;
  /** Día con más actividad del periodo. `null` si el periodo está vacío. */
  mejorDia: PuntoSerie | null;
  dispositivos: RepartoDispositivo;
  desde: string;
  hasta: string;
}

export const SERIE_VACIA: SerieEstadisticas = {
  serie: [],
  total: 0,
  media: 0,
  mejorDia: null,
  dispositivos: { movil: 0, tablet: 0, escritorio: 0, otro: 0 },
  desde: "",
  hasta: "",
};
