/**
 * Motor de cálculo puro del Modelo 130 (Pago fraccionado IRPF).
 * Estimación directa simplificada. 20 % sobre rendimiento neto acumulado.
 */
import type { AsignacionModelo, CasillasMap, FacturaParaModelo } from "../types/modelos";
import { CASILLAS_130, PORCENTAJE_PAGO_FRACCIONADO_130 } from "../data/epigrafes-130";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Calcular130Input {
  asignaciones: AsignacionModelo[];
  facturas: FacturaParaModelo[];
  pagosTrimestresAnteriores?: number;
  retencionesSoportadas?: number;
}

export function calcular130(input: Calcular130Input): CasillasMap {
  const { asignaciones, facturas } = input;
  const facturasMap = new Map(facturas.map((f) => [f.id, f]));
  const casillas: CasillasMap = {};

  let ingresos = 0;
  let gastos = 0;

  for (const asg of asignaciones) {
    const f = facturasMap.get(asg.factura_id);
    if (!f) continue;
    if (asg.casilla === CASILLAS_130.INGRESOS) ingresos += asg.importe;
    if (asg.casilla === CASILLAS_130.GASTOS) gastos += asg.importe;
  }

  casillas[CASILLAS_130.INGRESOS] = round2(ingresos);
  casillas[CASILLAS_130.GASTOS] = round2(gastos);

  const rendimientoNeto = round2(ingresos - gastos);
  casillas[CASILLAS_130.RENDIMIENTO_NETO] = rendimientoNeto;

  const pagoFraccionado = round2((rendimientoNeto * PORCENTAJE_PAGO_FRACCIONADO_130) / 100);
  casillas[CASILLAS_130.PORCENTAJE] = PORCENTAJE_PAGO_FRACCIONADO_130;
  casillas[CASILLAS_130.PAGO_FRACCIONADO] = pagoFraccionado;

  const pagosAnteriores = input.pagosTrimestresAnteriores ?? 0;
  const retenciones = input.retencionesSoportadas ?? 0;
  casillas[CASILLAS_130.PAGOS_ANTERIORES_TRIMESTRE] = round2(pagosAnteriores);
  casillas[CASILLAS_130.RETENCIONES] = round2(retenciones);

  const resultado = round2(pagoFraccionado - pagosAnteriores - retenciones);
  casillas[CASILLAS_130.RESULTADO] = resultado;

  return casillas;
}
