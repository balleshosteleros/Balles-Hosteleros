import { claveDiaEnZona, formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";

/**
 * EL TIEMPO DE LOS COMUNICADOS, EN UN SOLO SITIO.
 *
 * Las dos pantallas del trabajador —el móvil y el ordenador— cuentan lo mismo:
 * las barras que separan «Hoy», «Esta semana» y «Anteriores», y el «hace…» que
 * dice de un vistazo si el comunicado es de hace un rato o de la semana pasada
 * (Iván, 12-09-2026). Todo se calcula en la zona horaria de la empresa.
 */

export type GrupoComunicado = "hoy" | "semana" | "antes";

export const GRUPO_COMUNICADO_LABEL: Record<GrupoComunicado, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  antes: "Anteriores",
};

/** En qué montón va cada comunicado: hoy, esta semana o antiguos. */
export function grupoComunicado(iso: string, tz: string): GrupoComunicado {
  const hoy = claveDiaEnZona(new Date().toISOString(), tz);
  const dia = claveDiaEnZona(iso, tz);
  if (dia === hoy) return "hoy";
  const diff = Date.now() - new Date(iso).getTime();
  return diff < 7 * 86_400_000 ? "semana" : "antes";
}

/** Los comunicados ya vienen del más nuevo al más viejo: se parten por montones. */
export function agruparComunicadosPorTiempo<T>(
  items: T[],
  fechaDe: (item: T) => string,
  tz: string,
): { clave: GrupoComunicado; lista: T[] }[] {
  const grupos: { clave: GrupoComunicado; lista: T[] }[] = [];
  for (const item of items) {
    const g = grupoComunicado(fechaDe(item), tz);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === g) ultimo.lista.push(item);
    else grupos.push({ clave: g, lista: [item] });
  }
  return grupos;
}

/** «ahora», «hace 20 min», «hace 3 h», «hace 2 d» y, pasada la semana, la fecha. */
export function hace(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.floor(hrs / 24);
  if (dias < 7) return `hace ${dias} d`;
  return formatFechaEnZona(iso, tz, { day: "numeric", month: "short", year: undefined });
}
