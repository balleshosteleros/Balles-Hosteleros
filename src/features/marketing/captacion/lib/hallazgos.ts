/**
 * Lo que hay que mirar: las conclusiones de la pantalla, sacadas de los datos.
 *
 * NO son textos escritos a mano. Cada una nace de una comprobación sobre las
 * cifras de esta empresa y solo aparece si se cumple, con sus números dentro.
 * Así siguen siendo verdad el mes que viene y valen igual para un local que
 * para otro; un párrafo fijo envejecería a la primera semana.
 */

import { labelOrigen } from "@/features/sala/data/origenes";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import type { CaptacionDatos } from "../types";
import { compararMismoTramo, rankingCanales, variacion } from "./agregados";

export interface Hallazgo {
  /** Palabra que lo encabeza: de qué va. */
  rotulo: string;
  titulo: string;
  texto: string;
}

/** Por debajo de esto, un porcentaje sobre cuatro reservas no dice nada. */
const MINIMO_RESERVAS = 60;
/** A partir de aquí, la mesa vacía sin avisar deja de ser ruido. */
const NO_SHOW_PREOCUPA = 5;
/** Mesa grande de verdad. */
const MESA_GRANDE = 4;

export function construirHallazgos(
  datos: CaptacionDatos,
  anio: number,
  mes: number,
): Hallazgo[] {
  return [
    hallazgoNoShow(datos),
    hallazgoMesasGrandes(datos),
    ...hallazgoMovimiento(datos, anio, mes),
    hallazgoSinCorreo(datos),
  ].filter((h): h is Hallazgo => h !== null);
}

/** El canal donde más gente reserva y luego no aparece. */
function hallazgoNoShow(datos: CaptacionDatos): Hallazgo | null {
  const candidatos = datos.calidad
    .filter((c) => c.reservas >= MINIMO_RESERVAS)
    .map((c) => ({ ...c, pct: (c.noShow / c.reservas) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  const peor = candidatos[0];
  if (!peor || peor.pct < NO_SHOW_PREOCUPA) return null;

  const mejor = candidatos[candidatos.length - 1];
  const comparacion =
    mejor && mejor.canal !== peor.canal
      ? ` Por comparar, en ${labelOrigen(mejor.canal).toLowerCase()} es del ${formatPorcentaje(mejor.pct, { max: 1 })}.`
      : "";

  return {
    rotulo: "Mesas vacías",
    titulo: `${labelOrigen(peor.canal)} es donde más gente no aparece`,
    texto:
      `De las ${formatNumero(peor.reservas)} reservas que trajo en los últimos dos años, ` +
      `el ${formatPorcentaje(peor.pct, { max: 1 })} no se presentó y otro ` +
      `${formatPorcentaje((peor.canceladas / peor.reservas) * 100, { max: 1 })} canceló.` +
      comparacion +
      " Quien cancela avisa y deja revender la mesa; quien no aparece la deja muerta esa noche.",
  };
}

/** El canal que trae las mesas más grandes, aunque traiga pocas. */
function hallazgoMesasGrandes(datos: CaptacionDatos): Hallazgo | null {
  const candidatos = datos.calidad
    .filter((c) => c.reservas >= MINIMO_RESERVAS)
    .sort((a, b) => b.mediaPersonas - a.mediaPersonas);
  const mayor = candidatos[0];
  if (!mayor || mayor.mediaPersonas < MESA_GRANDE) return null;

  const volumen = [...datos.calidad].sort((a, b) => b.reservas - a.reservas)[0];
  const contraste =
    volumen && volumen.canal !== mayor.canal
      ? ` El canal que más reservas trae, ${labelOrigen(volumen.canal).toLowerCase()}, las trae de ${formatNumero(volumen.mediaPersonas, { min: 1, max: 1 })}.`
      : "";

  return {
    rotulo: "Mesas grandes",
    titulo: `${labelOrigen(mayor.canal)} trae las mesas más llenas`,
    texto:
      `${formatNumero(mayor.mediaPersonas, { min: 1, max: 1 })} personas de media por reserva.` +
      contraste +
      " Un canal con pocas reservas puede estar llenando más sillas que otro con el triple.",
  };
}

/** El canal que más sube y el que más baja frente al año pasado. */
function hallazgoMovimiento(
  datos: CaptacionDatos,
  anio: number,
  mes: number,
): Hallazgo[] {
  const movimientos = rankingCanales(datos.porMes)
    .map((canal) => {
      const { actual, anterior } = compararMismoTramo(datos.porMes, anio, mes, canal);
      return {
        canal,
        actual: actual.reservas,
        anterior: anterior.reservas,
        dif: variacion(actual.reservas, anterior.reservas),
      };
    })
    // Con menos de 40 reservas el año pasado, un "+300 %" son doce reservas.
    .filter((m) => m.anterior >= 40 && m.dif !== null);

  if (movimientos.length === 0) return [];

  const sube = [...movimientos].sort((a, b) => (b.dif ?? 0) - (a.dif ?? 0))[0];
  const baja = [...movimientos].sort((a, b) => (a.dif ?? 0) - (b.dif ?? 0))[0];

  const out: Hallazgo[] = [];
  if (sube && (sube.dif ?? 0) > 5) {
    out.push({
      rotulo: "Sube",
      titulo: `${labelOrigen(sube.canal)} es lo que más crece este año`,
      texto:
        `${formatNumero(sube.actual)} reservas en lo que va de ${anio}, frente a ` +
        `${formatNumero(sube.anterior)} en el mismo tramo de ${anio - 1}: un ` +
        `${formatPorcentaje(sube.dif ?? 0, { max: 1 })} más.`,
    });
  }
  if (baja && (baja.dif ?? 0) < -5 && baja.canal !== sube?.canal) {
    out.push({
      rotulo: "Baja",
      titulo: `${labelOrigen(baja.canal)} es lo que más se cae`,
      texto:
        `De ${formatNumero(baja.anterior)} reservas a ${formatNumero(baja.actual)} en el ` +
        `mismo tramo del año: un ${formatPorcentaje(Math.abs(baja.dif ?? 0), { max: 1 })} menos.`,
    });
  }
  return out;
}

/** La parte de la base a la que no se puede escribir por correo. */
function hallazgoSinCorreo(datos: CaptacionDatos): Hallazgo | null {
  const total = datos.clientes.reduce((s, c) => s + c.clientes, 0);
  if (total === 0) return null;

  const peor = [...datos.clientes]
    .map((c) => ({ ...c, sinCorreo: c.clientes - c.conEmail }))
    .sort((a, b) => b.sinCorreo - a.sinCorreo)[0];
  if (!peor || peor.sinCorreo / total < 0.15) return null;

  return {
    rotulo: "Base de clientes",
    titulo: `${formatNumero(peor.sinCorreo)} fichas sin correo, todas de ${labelOrigen(peor.canal).toLowerCase()}`,
    texto:
      `Son el ${formatPorcentaje((peor.sinCorreo / total) * 100, { max: 0 })} de toda la base, y ` +
      `${formatNumero(peor.hanVenido)} de ellas han llegado a venir alguna vez. ` +
      "Cualquier campaña por correo las deja fuera: a esa gente solo se le llega por WhatsApp o SMS.",
  };
}
