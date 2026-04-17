/**
 * Cálculo de totales del ticket POS.
 * Se usa en cliente (ticket en vivo) y en servidor (persistencia).
 *
 * Reglas:
 *   - Cada línea tiene: cantidad × precioUnitario × (1 − descuentoPct/100)
 *   - El IVA se desglosa por `ivaPct` (10% / 21% / 4% / 0%)
 *   - El descuento de cabecera (de Gerencia) se aplica sobre el subtotal (base+iva) — configurable.
 *   - Toda comparación en euros usa redondeo a 2 decimales.
 */

import type { TicketLinea, TotalesTicket } from "../types";

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface DescuentoCabecera {
  tipo: "PCT" | "FIJO";
  valor: number;
  /** Si true, el descuento se resta antes de IVA. Default false (sobre total bruto). */
  antesDeIva?: boolean;
}

export function calcularTotales(
  lineas: TicketLinea[],
  descuento?: DescuentoCabecera | null
): TotalesTicket {
  let baseImponible = 0;
  const ivaDesglosado: Record<string, number> = {};

  for (const l of lineas) {
    const bruto = l.cantidad * l.precioUnitario;
    const neto = bruto * (1 - (l.descuentoPct ?? 0) / 100);
    // En España el precio de venta suele ser IVA incluido → desglosamos
    const base = neto / (1 + l.ivaPct / 100);
    const iva = neto - base;

    baseImponible += base;
    const key = String(l.ivaPct);
    ivaDesglosado[key] = (ivaDesglosado[key] ?? 0) + iva;
  }

  let iva = Object.values(ivaDesglosado).reduce((a, b) => a + b, 0);
  let subtotal = baseImponible + iva;
  let descuentoAplicado = 0;

  if (descuento && descuento.valor > 0) {
    if (descuento.antesDeIva) {
      // Aplicar sobre la base, recalcular IVA proporcionalmente
      const factor =
        descuento.tipo === "PCT"
          ? 1 - descuento.valor / 100
          : Math.max(0, 1 - descuento.valor / Math.max(baseImponible, 0.01));
      baseImponible = baseImponible * factor;
      for (const k of Object.keys(ivaDesglosado)) {
        ivaDesglosado[k] = ivaDesglosado[k] * factor;
      }
      iva = Object.values(ivaDesglosado).reduce((a, b) => a + b, 0);
      descuentoAplicado = (baseImponible + iva) / factor - (baseImponible + iva);
      subtotal = baseImponible + iva;
    } else {
      // Aplicar sobre el total (mantiene proporcionalidad del IVA desglosado)
      descuentoAplicado =
        descuento.tipo === "PCT"
          ? (subtotal * descuento.valor) / 100
          : Math.min(descuento.valor, subtotal);
      const factor = subtotal > 0 ? 1 - descuentoAplicado / subtotal : 0;
      baseImponible *= factor;
      for (const k of Object.keys(ivaDesglosado)) {
        ivaDesglosado[k] = ivaDesglosado[k] * factor;
      }
      iva = Object.values(ivaDesglosado).reduce((a, b) => a + b, 0);
      subtotal = baseImponible + iva;
    }
  }

  // Redondeos finales
  for (const k of Object.keys(ivaDesglosado)) ivaDesglosado[k] = r2(ivaDesglosado[k]);

  return {
    subtotal: r2(subtotal + descuentoAplicado),
    descuento: r2(descuentoAplicado),
    baseImponible: r2(baseImponible),
    iva: r2(iva),
    total: r2(subtotal),
    ivaDesglosado,
  };
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}
