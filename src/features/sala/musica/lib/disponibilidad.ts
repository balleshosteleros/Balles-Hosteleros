/**
 * ¿Puede sonar esta lista AHORA MISMO?
 *
 * Una lista de copas sonando a las 9 de la mañana es un error de servicio. Por
 * eso cada lista puede llevar franjas horarias: fuera de ellas queda bloqueada y
 * el botón de Play no responde.
 *
 * Dos detalles que parecen menores y no lo son:
 *
 *  1. La hora es la de la EMPRESA, no la del servidor (que en producción es UTC)
 *     ni la del navegador del encargado. Ver `zona-horaria.ts` (PRP-069).
 *
 *  2. Las franjas de noche CRUZAN la medianoche: "Cena 20:00–00:00" o
 *     "Copas 23:00–03:00" terminan al día siguiente. Comparar horas sueltas con
 *     `inicio <= ahora && ahora <= fin` daría false toda la noche. Aquí, cuando
 *     `fin <= inicio`, la franja se entiende como "hasta el día siguiente", y el
 *     día de la semana que manda es el de su COMIENZO: una franja de viernes
 *     23:00–03:00 sigue activa a la 01:00 del sábado.
 *
 * Funciones puras: valen en cliente y en servidor.
 */

import type { HorarioLista } from "@/features/sala/musica/types";

const ZONA_FALLBACK = "Europe/Madrid";

/** Minutos desde medianoche de un "HH:MM". Devuelve null si no es válido. */
function aMinutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * "Ahora" en la zona de la empresa: día ISO (1=lunes..7=domingo) y minutos
 * desde medianoche. Se obtiene formateando el instante en esa zona, para que el
 * horario de verano/invierno se aplique solo.
 */
export function ahoraEnZona(
  tz: string,
  ahora: Date = new Date(),
): { diaIso: number; minutos: number } {
  const zona = (tz ?? "").trim() || ZONA_FALLBACK;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = fmt.formatToParts(ahora);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";

  const mapaDias: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  const diaIso = mapaDias[get("weekday")] ?? 1;

  // Intl puede devolver "24" a medianoche en algunos entornos; se normaliza a 0.
  const h = Number(get("hour")) % 24;
  const min = Number(get("minute"));
  return { diaIso, minutos: h * 60 + min };
}

/** Día ISO anterior (para franjas que empezaron ayer y siguen vivas). */
function diaAnterior(diaIso: number): number {
  return diaIso === 1 ? 7 : diaIso - 1;
}

/** ¿Una franja concreta cubre el momento actual? */
function franjaCubre(
  h: HorarioLista,
  diaIso: number,
  minutos: number,
): boolean {
  const inicio = aMinutos(h.horaInicio);
  const finBruto = aMinutos(h.horaFin);
  if (inicio === null || finBruto === null) return false;

  const dias = Array.isArray(h.dias) ? h.dias : [];
  if (dias.length === 0) return false;

  // "00:00" como fin significa medianoche del día siguiente (24:00), no las
  // 00:00 de esta misma madrugada — es como se escribe "Cena 20:00–00:00".
  const cruzaMedianoche = finBruto <= inicio;

  if (!cruzaMedianoche) {
    return dias.includes(diaIso) && minutos >= inicio && minutos < finBruto;
  }

  // Cruza medianoche: dos tramos.
  //  · Hoy desde `inicio` hasta las 24:00 → el día de la franja es HOY.
  //  · Hoy desde las 00:00 hasta `fin`    → la franja empezó AYER.
  if (dias.includes(diaIso) && minutos >= inicio) return true;
  if (dias.includes(diaAnterior(diaIso)) && minutos < finBruto) return true;
  return false;
}

/** Formatea una franja para explicar al usuario cuándo sí puede sonar. */
export function describirHorarios(horarios: HorarioLista[]): string {
  const textos = horarios
    .map((h) => `${h.horaInicio}–${h.horaFin}`)
    .filter((t) => t.length > 1);
  if (textos.length === 0) return "";
  return textos.join(", ");
}

/**
 * Resultado de disponibilidad de una lista.
 * `sinHorario` = true → siempre disponible, sin mirar franjas.
 */
export function calcularDisponibilidad(
  sinHorario: boolean,
  horarios: HorarioLista[],
  tz: string,
  ahora: Date = new Date(),
): { disponible: boolean; motivo: string | null } {
  if (sinHorario) return { disponible: true, motivo: null };

  // Marcada con horario pero sin ninguna franja definida: no se puede decidir a
  // favor sin inventarse una regla. Se bloquea y se dice por qué, para que
  // quien la configuró lo vea y la arregle.
  if (!horarios || horarios.length === 0) {
    return {
      disponible: false,
      motivo: "Sin franjas horarias configuradas",
    };
  }

  const { diaIso, minutos } = ahoraEnZona(tz, ahora);
  const disponible = horarios.some((h) => franjaCubre(h, diaIso, minutos));

  return {
    disponible,
    motivo: disponible ? null : `Disponible ${describirHorarios(horarios)}`,
  };
}
