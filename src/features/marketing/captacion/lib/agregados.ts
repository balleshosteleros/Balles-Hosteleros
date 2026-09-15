/**
 * Las cuentas de Captación: de los datos por mes a lo que se pinta.
 *
 * Todo son funciones puras sobre lo que devuelve la base, sin estado ni
 * consultas. Viven aparte de la vista porque son la parte que hay que poder
 * leer sin abrir una gráfica: aquí está la definición de "año en curso" y la de
 * "mismo tramo del año pasado", que es de donde salen todas las comparaciones.
 */

import type { CaptacionDatos, MesCanal } from "../types";

/** Cuántos canales se pintan con su propio color. El resto van juntos. */
export const CANALES_EN_GRAFICA = 7;

/** Clave del montón que agrupa la cola larga de canales pequeños. */
export const CANAL_RESTO = "__RESTO__";

export interface TotalCanal {
  canal: string;
  reservas: number;
  comensales: number;
}

/** Años con datos, del más antiguo al más reciente. */
export function aniosConDatos(porMes: MesCanal[]): number[] {
  return [...new Set(porMes.map((m) => m.anio))].sort((a, b) => a - b);
}

/** Suma por canal de todo lo que se le pase. */
export function sumarPorCanal(filas: MesCanal[]): TotalCanal[] {
  const acc = new Map<string, TotalCanal>();
  for (const f of filas) {
    const t = acc.get(f.canal) ?? { canal: f.canal, reservas: 0, comensales: 0 };
    t.reservas += f.reservas;
    t.comensales += f.comensales;
    acc.set(f.canal, t);
  }
  return [...acc.values()].sort((a, b) => b.reservas - a.reservas);
}

/** Los canales que más han traído en toda la historia, de mayor a menor. */
export function rankingCanales(porMes: MesCanal[]): string[] {
  return sumarPorCanal(porMes).map((t) => t.canal);
}

/**
 * Los canales que llevan color propio en la gráfica.
 *
 * El resto se suma en un único montón: con dieciocho canales —la mayoría con
 * cuatro reservas en cinco años— la gráfica se vuelve un arcoíris ilegible.
 * Ninguno se pierde: la tabla de debajo los lista todos, uno por uno.
 */
export function canalesDestacados(porMes: MesCanal[]): string[] {
  return rankingCanales(porMes).slice(0, CANALES_EN_GRAFICA);
}

/** Fila por año lista para la gráfica apilada: una clave por canal destacado. */
export function filasPorAnio(
  porMes: MesCanal[],
  destacados: string[],
): Array<Record<string, number | string>> {
  const conColor = new Set(destacados);
  const porAnio = new Map<number, Record<string, number>>();
  for (const f of porMes) {
    const fila = porAnio.get(f.anio) ?? {};
    const clave = conColor.has(f.canal) ? f.canal : CANAL_RESTO;
    fila[clave] = (fila[clave] ?? 0) + f.reservas;
    porAnio.set(f.anio, fila);
  }
  return [...porAnio.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([anio, valores]) => ({ anio: String(anio), ...valores }));
}

export interface ComparativaAnio {
  anio: number;
  /** Hasta qué mes se cuenta (12 en los años cerrados). */
  hastaMes: number;
  reservas: number;
  comensales: number;
}

/**
 * El año en curso frente al MISMO TRAMO del año anterior.
 *
 * A mitad de septiembre, comparar nueve meses contra doce enteros diría que el
 * negocio se ha hundido un tercio sin que haya pasado nada. Por eso los dos
 * lados se cortan por el mismo mes.
 */
export function compararMismoTramo(
  porMes: MesCanal[],
  anio: number,
  hastaMes: number,
  canal?: string,
): { actual: ComparativaAnio; anterior: ComparativaAnio } {
  const tramo = (a: number): ComparativaAnio => {
    const filas = porMes.filter(
      (m) => m.anio === a && m.mes <= hastaMes && (!canal || m.canal === canal),
    );
    return {
      anio: a,
      hastaMes,
      reservas: filas.reduce((s, m) => s + m.reservas, 0),
      comensales: filas.reduce((s, m) => s + m.comensales, 0),
    };
  };
  return { actual: tramo(anio), anterior: tramo(anio - 1) };
}

/**
 * Variación en tanto por ciento. `null` cuando no hay con qué comparar: sin
 * año anterior no es "0 %", es que no se sabe.
 */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

/** Reservas de un canal año a año, para la tabla comparativa. */
export function reservasPorCanalYAnio(
  porMes: MesCanal[],
): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const f of porMes) {
    const porAnio = out.get(f.canal) ?? new Map<number, number>();
    porAnio.set(f.anio, (porAnio.get(f.anio) ?? 0) + f.reservas);
    out.set(f.canal, porAnio);
  }
  return out;
}

/** Cuántas fichas de cliente hay en total y a cuántas se les puede escribir. */
export function resumenClientes(datos: CaptacionDatos) {
  const total = datos.clientes.reduce((s, c) => s + c.clientes, 0);
  const conEmail = datos.clientes.reduce((s, c) => s + c.conEmail, 0);
  const hanVenido = datos.clientes.reduce((s, c) => s + c.hanVenido, 0);
  const repiten = datos.clientes.reduce((s, c) => s + c.repiten, 0);
  return { total, conEmail, hanVenido, repiten };
}
