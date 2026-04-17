/**
 * Algoritmos de división de cuenta.
 *
 * Modos:
 *   - "articulos"   → el usuario asigna cada línea a un comensal (1..N)
 *   - "partesIguales" → partir el total entre N comensales (último absorbe el redondeo)
 *   - "mitades"     → dos subtickets con reparto libre en euros (útil para "yo pago 40, tú 60")
 */

import type { TicketLinea, SubTicket } from "../types";
import { calcularTotales } from "./calculo-ticket";

// ─── POR ARTÍCULOS ───────────────────────────────────────────

/**
 * @param asignacion  Map<lineaId, comensalIdx> (1..N). Líneas sin asignación van al subticket "Sin asignar".
 */
export function dividirPorArticulos(
  lineas: TicketLinea[],
  asignacion: Map<string, number>,
  numComensales: number
): SubTicket[] {
  const subs: SubTicket[] = [];
  for (let i = 1; i <= numComensales; i++) {
    const propias = lineas.filter((l) => asignacion.get(l.id) === i);
    if (propias.length === 0) continue;
    subs.push({
      id: `sub_${i}`,
      label: `Comensal ${i}`,
      lineas: propias,
      totales: calcularTotales(propias, null),
    });
  }
  const sinAsignar = lineas.filter((l) => !asignacion.has(l.id));
  if (sinAsignar.length > 0) {
    subs.push({
      id: `sub_sin`,
      label: `Sin asignar`,
      lineas: sinAsignar,
      totales: calcularTotales(sinAsignar, null),
    });
  }
  return subs;
}

// ─── PARTES IGUALES ──────────────────────────────────────────

export function dividirPartesIguales(
  lineas: TicketLinea[],
  numPartes: number
): SubTicket[] {
  if (numPartes < 1) numPartes = 1;
  const totalRes = calcularTotales(lineas, null);
  const porParte = Math.floor((totalRes.total * 100) / numPartes) / 100;
  const resto = Math.round((totalRes.total - porParte * numPartes) * 100) / 100;

  const subs: SubTicket[] = [];
  for (let i = 1; i <= numPartes; i++) {
    const importe = i === numPartes ? porParte + resto : porParte;
    subs.push({
      id: `part_${i}`,
      label: `Parte ${i} / ${numPartes}`,
      lineas: [], // partes iguales no se desglosan por líneas
      totales: {
        baseImponible: 0,
        iva: 0,
        descuento: 0,
        subtotal: importe,
        total: importe,
        ivaDesglosado: {},
      },
    });
  }
  return subs;
}

// ─── MITADES (reparto libre en euros) ────────────────────────

/**
 * Dos subtickets. Cada uno recibe un importe libre. La suma debe cuadrar con el total.
 */
export function dividirMitades(
  lineas: TicketLinea[],
  importe1: number
): { subs: SubTicket[]; error?: string } {
  const totales = calcularTotales(lineas, null);
  if (importe1 < 0 || importe1 > totales.total) {
    return { subs: [], error: `Importe fuera de rango (0 – ${totales.total.toFixed(2)}€).` };
  }
  const importe2 = Math.round((totales.total - importe1) * 100) / 100;
  return {
    subs: [
      {
        id: "mit_1",
        label: "Parte A",
        lineas: [],
        totales: {
          baseImponible: 0,
          iva: 0,
          descuento: 0,
          subtotal: importe1,
          total: importe1,
          ivaDesglosado: {},
        },
      },
      {
        id: "mit_2",
        label: "Parte B",
        lineas: [],
        totales: {
          baseImponible: 0,
          iva: 0,
          descuento: 0,
          subtotal: importe2,
          total: importe2,
          ivaDesglosado: {},
        },
      },
    ],
  };
}
