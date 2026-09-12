/**
 * Cuándo se sirve cada categoría de la carta.
 *
 * Una sola carta y un solo enlace: se llegue por el QR de la mesa o desde la
 * web del restaurante, se enseña lo que la cocina está sirviendo EN ESE
 * MOMENTO. Quien decide qué es "ese momento" es este archivo, y lo hace con el
 * reloj de la EMPRESA, no con el del móvil del comensal: si alguien abre la
 * carta con el teléfono en otra zona horaria, tiene que ver lo que se sirve
 * aquí.
 *
 * Se usa en dos sitios y por eso vive aparte: la carta pública filtra con
 * `categoriaEnHorario`, y el panel escribe con `textoHorario` la misma frase
 * que leería un cliente, para que quien configura vea lo que está prometiendo.
 */

import { minutosDiaEnZona, hoyEnZona } from "@/features/empresa/lib/zona-horaria";

/** Ventana de una categoría. 1 = lunes … 7 = domingo; `null` = siempre. */
export type VentanaHorario = {
  dias_semana: number[] | null;
  hora_desde: string | null;
  hora_hasta: string | null;
};

export const DIAS_NOMBRE = [
  "",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

/** Iniciales para los botones del panel, en el orden de la semana. */
export const DIAS_CORTOS = [
  { n: 1, letra: "L", nombre: "lunes" },
  { n: 2, letra: "M", nombre: "martes" },
  { n: 3, letra: "X", nombre: "miércoles" },
  { n: 4, letra: "J", nombre: "jueves" },
  { n: 5, letra: "V", nombre: "viernes" },
  { n: 6, letra: "S", nombre: "sábado" },
  { n: 7, letra: "D", nombre: "domingo" },
] as const;

/** "12:30" o "12:30:00" → 750. */
function aMinutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/** Día de la semana de hoy (1 = lunes … 7 = domingo) en la zona de la empresa. */
function diaSemanaEnZona(zona: string): number {
  // `hoyEnZona` da "YYYY-MM-DD" del día de la EMPRESA; leerlo como fecha UTC
  // evita que el día del servidor mueva el resultado.
  const dia = new Date(`${hoyEnZona(zona)}T00:00:00Z`).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/**
 * ¿Se sirve esta categoría ahora mismo?
 *
 * Sin días ni horas, siempre. Con ellos, hay dos formas de ventana:
 *
 * - **Normal** (12:30 → 16:30): se sirve entre las dos horas.
 * - **Cruzando la medianoche** (23:30 → 19:30): la hora de fin es MENOR que la
 *   de inicio, así que la ventana salta al día siguiente. Se sirve desde las
 *   23:30 hasta el final del día y desde el principio del día siguiente hasta
 *   las 19:30; lo que queda fuera —de 19:30 a 23:30— es el hueco en el que la
 *   categoría no aparece.
 *
 * Cuando la ventana cruza la medianoche, la madrugada cuenta como parte del día
 * ANTERIOR para el filtro de días: un menú de lunes a viernes que arranca a las
 * 23:30 del viernes sigue sirviéndose el sábado de madrugada, porque es el
 * mismo servicio.
 */
export function categoriaEnHorario(c: VentanaHorario, zona: string): boolean {
  if (!c.dias_semana?.length && !c.hora_desde && !c.hora_hasta) return true;

  const minutos = minutosDiaEnZona(new Date(), zona);
  const desde = c.hora_desde ? aMinutos(c.hora_desde) : null;
  const hasta = c.hora_hasta ? aMinutos(c.hora_hasta) : null;
  const cruzaMedianoche = desde !== null && hasta !== null && desde > hasta;

  if (cruzaMedianoche) {
    if (minutos < desde! && minutos > hasta!) return false;
  } else {
    if (desde !== null && minutos < desde) return false;
    if (hasta !== null && minutos > hasta) return false;
  }

  if (c.dias_semana?.length) {
    const hoy = diaSemanaEnZona(zona);
    const esLaMadrugadaDeAyer = cruzaMedianoche && minutos <= hasta!;
    const diaServicio = esLaMadrugadaDeAyer ? (hoy === 1 ? 7 : hoy - 1) : hoy;
    if (!c.dias_semana.includes(diaServicio)) return false;
  }

  return true;
}

/**
 * El horario de la categoría escrito para que lo lea una persona:
 * "Se sirve de lunes a viernes, de 12:30 a 16:30".
 *
 * Se enseña en el panel, debajo de los controles, para que quien configura la
 * carta lea en castellano lo que acaba de marcar. `null` = se sirve siempre.
 */
export function textoHorario(c: VentanaHorario): string | null {
  const dias = c.dias_semana?.length ? [...c.dias_semana].sort((a, b) => a - b) : null;
  let parteDias: string | null = null;

  if (dias && dias.length < 7) {
    const consecutivos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
    if (dias.length === 1) {
      parteDias = `los ${DIAS_NOMBRE[dias[0]]}`;
    } else if (consecutivos) {
      parteDias = `de ${DIAS_NOMBRE[dias[0]]} a ${DIAS_NOMBRE[dias[dias.length - 1]]}`;
    } else {
      const nombres = dias.map((d) => DIAS_NOMBRE[d]);
      parteDias = `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
    }
  } else if (dias) {
    parteDias = "todos los días";
  }

  const hhmm = (h: string) => h.slice(0, 5);
  let parteHoras: string | null = null;
  if (c.hora_desde && c.hora_hasta) {
    // Fin antes que inicio = la ventana termina al día siguiente. Decirlo, o
    // "de 23:30 a 19:30" se lee como un error de quien lo configuró.
    const cruza = aMinutos(c.hora_desde) > aMinutos(c.hora_hasta);
    parteHoras = `de ${hhmm(c.hora_desde)} a ${hhmm(c.hora_hasta)}${cruza ? " del día siguiente" : ""}`;
  } else if (c.hora_desde) {
    parteHoras = `a partir de las ${hhmm(c.hora_desde)}`;
  } else if (c.hora_hasta) {
    parteHoras = `hasta las ${hhmm(c.hora_hasta)}`;
  }

  if (!parteDias && !parteHoras) return null;
  return `Se sirve ${[parteDias, parteHoras].filter(Boolean).join(", ")}`;
}
