/**
 * Motor de cálculo puro del Modelo 115 (Retenciones alquiler inmuebles urbanos 19 %).
 */
import type { AsignacionModelo, CasillasMap, FacturaParaModelo } from "../types/modelos";
import { CASILLAS_115 } from "../data/epigrafes-115";
import { RETENCION_ALQUILERES_PCT } from "../types/modelos";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Calcular115Input {
  asignaciones: AsignacionModelo[];
  facturas: FacturaParaModelo[];
}

export function calcular115(input: Calcular115Input): CasillasMap {
  const { asignaciones, facturas } = input;
  const facturasMap = new Map(facturas.map((f) => [f.id, f]));
  const casillas: CasillasMap = {};

  const perceptoresUnicos = new Set<string>();
  let baseRetenciones = 0;

  for (const asg of asignaciones) {
    const f = facturasMap.get(asg.factura_id);
    if (!f) continue;
    if (asg.casilla === CASILLAS_115.BASE_RETENCIONES) {
      baseRetenciones += asg.importe;
      if (f.contacto_id) perceptoresUnicos.add(f.contacto_id);
    }
  }

  casillas[CASILLAS_115.NUM_PERCEPTORES] = perceptoresUnicos.size;
  casillas[CASILLAS_115.BASE_RETENCIONES] = round2(baseRetenciones);

  const importeRetencion = round2((baseRetenciones * RETENCION_ALQUILERES_PCT) / 100);
  casillas[CASILLAS_115.IMPORTE_RETENCIONES] = importeRetencion;
  casillas[CASILLAS_115.RESULTADO] = importeRetencion;

  return casillas;
}
