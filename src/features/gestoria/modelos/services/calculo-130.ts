/**
 * Motor de cálculo puro del Modelo 130 (Pago fraccionado IRPF).
 * Estimación directa simplificada.
 *
 * El 130 es ACUMULATIVO desde el 1 de enero: las casillas 01/02/03 recogen los
 * ingresos y gastos del ejercicio hasta el fin del trimestre declarado, el 20 %
 * se aplica sobre ese rendimiento acumulado, y de la cuota resultante se restan
 * los pagos ya hechos en trimestres anteriores (casilla 08) y las retenciones
 * soportadas (casilla 06). Cada magnitud se resta UNA sola vez.
 */
import type { AsignacionModelo, CasillasMap, FacturaParaModelo } from "../types/modelos";
import { CASILLAS_130, PORCENTAJE_PAGO_FRACCIONADO_130 } from "../data/epigrafes-130";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Calcular130Input {
  asignaciones: AsignacionModelo[];
  /** Facturas del ejercicio ACUMULADAS hasta el fin del trimestre declarado. */
  facturas: FacturaParaModelo[];
  /** Suma de la casilla 07 de los trimestres anteriores del mismo ejercicio. */
  pagosTrimestresAnteriores?: number;
}

/** Una rectificativa resta: invierte el signo de lo que aporta a la casilla. */
function signoFactura(f: FacturaParaModelo): number {
  return f.tipo_factura === "rectificativa" ? -1 : 1;
}

export function calcular130(input: Calcular130Input): CasillasMap {
  const { asignaciones, facturas } = input;
  const facturasMap = new Map(facturas.map((f) => [f.id, f]));
  const casillas: CasillasMap = {};

  let ingresos = 0;
  let gastos = 0;
  let retenciones = 0;

  for (const asg of asignaciones) {
    const f = facturasMap.get(asg.factura_id);
    if (!f) continue;
    const importe = asg.importe * signoFactura(f);
    if (asg.casilla === CASILLAS_130.INGRESOS) ingresos += importe;
    if (asg.casilla === CASILLAS_130.GASTOS) gastos += importe;
    // Las retenciones que los clientes han practicado ya vienen asignadas a su
    // propia casilla (06): NO se vuelven a restar por fuera.
    if (asg.casilla === CASILLAS_130.RETENCIONES) retenciones += importe;
  }

  casillas[CASILLAS_130.INGRESOS] = round2(ingresos);
  casillas[CASILLAS_130.GASTOS] = round2(gastos);

  const rendimientoNeto = round2(ingresos - gastos);
  casillas[CASILLAS_130.RENDIMIENTO_NETO] = rendimientoNeto;

  // Si el rendimiento acumulado es negativo no hay pago fraccionado (no se
  // devuelve nada: el resultado es 0, la pérdida se compensa en la renta).
  const pagoFraccionado =
    rendimientoNeto > 0
      ? round2((rendimientoNeto * PORCENTAJE_PAGO_FRACCIONADO_130) / 100)
      : 0;
  casillas[CASILLAS_130.PORCENTAJE] = PORCENTAJE_PAGO_FRACCIONADO_130;
  casillas[CASILLAS_130.PAGO_FRACCIONADO] = pagoFraccionado;

  const pagosAnteriores = input.pagosTrimestresAnteriores ?? 0;
  casillas[CASILLAS_130.PAGOS_ANTERIORES_TRIMESTRE] = round2(pagosAnteriores);
  casillas[CASILLAS_130.RETENCIONES] = round2(retenciones);

  // El resultado nunca es negativo en el 130: si lo fuera, se declara 0.
  const resultado = Math.max(0, round2(pagoFraccionado - pagosAnteriores - retenciones));
  casillas[CASILLAS_130.RESULTADO] = resultado;

  return casillas;
}
