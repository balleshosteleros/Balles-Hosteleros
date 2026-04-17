/**
 * Motor de cálculo puro del Modelo 303 (IVA trimestral).
 * Entrada: asignaciones factura ↔ casilla.
 * Salida: JSON de casillas con totales calculados.
 * Lógica pura: sin I/O, determinista, testeable.
 */
import type { AsignacionModelo, CasillasMap, FacturaParaModelo } from "../types/modelos";
import { CASILLAS_303_RESULTADO } from "../data/epigrafes-303";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function add(map: CasillasMap, casilla: string, importe: number): void {
  map[casilla] = round2((map[casilla] ?? 0) + importe);
}

export interface Calcular303Input {
  asignaciones: AsignacionModelo[];
  facturas: FacturaParaModelo[];
  cuotasCompensarPeriodosAnteriores?: number;
}

export function calcular303(input: Calcular303Input): CasillasMap {
  const { asignaciones, facturas } = input;
  const facturasMap = new Map(facturas.map((f) => [f.id, f]));
  const casillas: CasillasMap = {};

  for (const asg of asignaciones) {
    const factura = facturasMap.get(asg.factura_id);
    if (!factura) continue;
    add(casillas, asg.casilla, asg.importe);
  }

  const baseIvaRepercutido =
    (casillas["01"] ?? 0) + (casillas["04"] ?? 0) + (casillas["07"] ?? 0);
  const cuotaIvaRepercutido =
    (casillas["03"] ?? 0) + (casillas["06"] ?? 0) + (casillas["09"] ?? 0);

  casillas["27"] = round2(cuotaIvaRepercutido);

  const ivaDeducibleCuota =
    (casillas["29"] ?? 0) +
    (casillas["31"] ?? 0) +
    (casillas["33"] ?? 0) +
    (casillas["35"] ?? 0) +
    (casillas["37"] ?? 0) +
    (casillas["39"] ?? 0) +
    (casillas["41"] ?? 0);

  casillas["45"] = round2(ivaDeducibleCuota);
  casillas["46"] = round2(cuotaIvaRepercutido - ivaDeducibleCuota);
  casillas["64"] = casillas["46"];

  const cuotasCompensar = input.cuotasCompensarPeriodosAnteriores ?? 0;
  casillas["67"] = round2(cuotasCompensar);
  const resultado = round2((casillas["64"] ?? 0) - cuotasCompensar);
  casillas["69"] = resultado;

  if (resultado > 0) {
    casillas[CASILLAS_303_RESULTADO.A_INGRESAR] = resultado;
  } else if (resultado < 0) {
    casillas[CASILLAS_303_RESULTADO.A_COMPENSAR] = -resultado;
  }

  casillas["_base_iva_repercutido_total"] = round2(baseIvaRepercutido);

  return casillas;
}

export function validarCuadre303(
  casillas: CasillasMap,
  facturas: FacturaParaModelo[],
): { cuadra: boolean; diferencia: number; detalle: string } {
  const totalIvaRepercutidoFacturas = facturas
    .filter((f) => f.tipo === "VENTA")
    .reduce((acc, f) => acc + f.iva_importe, 0);

  const totalCuotaRepercutidaCasillas =
    (casillas["03"] ?? 0) + (casillas["06"] ?? 0) + (casillas["09"] ?? 0);

  const diferencia = round2(totalIvaRepercutidoFacturas - totalCuotaRepercutidaCasillas);
  const cuadra = Math.abs(diferencia) < 0.02;

  return {
    cuadra,
    diferencia,
    detalle: cuadra
      ? `IVA repercutido cuadra: ${totalCuotaRepercutidaCasillas.toFixed(2)} €`
      : `Desviación ${diferencia.toFixed(2)} € entre facturas (${totalIvaRepercutidoFacturas.toFixed(2)}) y casillas (${totalCuotaRepercutidaCasillas.toFixed(2)})`,
  };
}
