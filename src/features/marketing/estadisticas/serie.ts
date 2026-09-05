import type {
  PuntoSerie,
  RepartoDispositivo,
  SerieEstadisticas,
} from "./types";

/** Fila cruda tal y como sale de `qr_escaneos` o de `paginas_web_visitas`. */
export interface FilaAgregada {
  fecha: string;
  dispositivo: string;
  total: number;
}

/** Suma un día a una fecha ISO sin pasar por `Date` con husos: trabajar en UTC
 *  aquí evita que un cambio de hora salte o repita un día en el eje. */
function sumarDia(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Convierte las filas sueltas de la base de datos en la serie que pinta la
 * gráfica: un punto por día del periodo (los días sin actividad valen 0), el
 * total, la media, el mejor día y el reparto por aparato.
 */
export function construirSerie(
  filas: FilaAgregada[],
  desde: string,
  hasta: string,
): SerieEstadisticas {
  const porDia = new Map<string, number>();
  const dispositivos: RepartoDispositivo = {
    movil: 0,
    tablet: 0,
    escritorio: 0,
    otro: 0,
  };

  for (const fila of filas) {
    const total = Number(fila.total) || 0;
    porDia.set(fila.fecha, (porDia.get(fila.fecha) ?? 0) + total);

    if (fila.dispositivo === "movil") dispositivos.movil += total;
    else if (fila.dispositivo === "tablet") dispositivos.tablet += total;
    else if (fila.dispositivo === "escritorio") dispositivos.escritorio += total;
    else dispositivos.otro += total;
  }

  const serie: PuntoSerie[] = [];
  // Tope de seguridad: un periodo absurdo por un parámetro mal formado no debe
  // generar una serie infinita.
  const MAX_DIAS = 800;
  let cursor = desde;
  while (cursor <= hasta && serie.length < MAX_DIAS) {
    serie.push({ fecha: cursor, total: porDia.get(cursor) ?? 0 });
    cursor = sumarDia(cursor);
  }

  const total = serie.reduce((acc, p) => acc + p.total, 0);
  const media = serie.length > 0 ? total / serie.length : 0;

  let mejorDia: PuntoSerie | null = null;
  for (const punto of serie) {
    if (punto.total > 0 && (!mejorDia || punto.total > mejorDia.total)) {
      mejorDia = punto;
    }
  }

  return { serie, total, media, mejorDia, dispositivos, desde, hasta };
}
