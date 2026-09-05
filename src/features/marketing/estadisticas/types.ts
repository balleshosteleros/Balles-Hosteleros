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

/**
 * Lo que la gente HACE dentro de la web, además de entrar: qué botones pulsa,
 * cuánto se queda y de dónde llega.
 *
 * Va aparte de `SerieEstadisticas` a propósito: los QR también usan esa serie y
 * un QR no tiene botones ni tiempo de permanencia dentro. Mezclarlo obligaría a
 * la gráfica de los QR a cargar con campos que nunca va a tener.
 */
export interface BotonPulsado {
  /** A dónde lleva. Es la identidad del botón: sobrevive a que se reescriba su texto. */
  destino: string;
  /** Cómo se lee en pantalla ("Reservar", "Ver la carta"). */
  etiqueta: string;
  total: number;
}

export interface OrigenVisitas {
  /** Familia normalizada: "google", "instagram", "directo"... */
  origen: string;
  total: number;
}

export interface ComportamientoWeb {
  /** Botones ordenados de más a menos pulsado. */
  botones: BotonPulsado[];
  /** Suma de todos los clics del periodo. */
  clicsTotales: number;
  /** Segundos de media por visita medida. 0 si no se ha podido medir ninguna. */
  segundosMedios: number;
  /** Cuántas visitas llegaron a medirse (no todas: quien cierra de golpe no manda nada). */
  visitasMedidas: number;
  /** % de visitas que se fueron sin tocar ni bajar nada. `null` si no hay datos. */
  porcentajeRebote: number | null;
  origenes: OrigenVisitas[];
}

export const COMPORTAMIENTO_VACIO: ComportamientoWeb = {
  botones: [],
  clicsTotales: 0,
  segundosMedios: 0,
  visitasMedidas: 0,
  porcentajeRebote: null,
  origenes: [],
};
