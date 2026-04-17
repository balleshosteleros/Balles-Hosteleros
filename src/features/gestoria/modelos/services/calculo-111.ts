/**
 * Motor de cálculo puro del Modelo 111 (Retenciones IRPF trimestral).
 */
import type { AsignacionModelo, CasillasMap, FacturaParaModelo } from "../types/modelos";
import { CASILLAS_111 } from "../data/epigrafes-111";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function add(map: CasillasMap, casilla: string, importe: number): void {
  map[casilla] = round2((map[casilla] ?? 0) + importe);
}

export interface Calcular111Input {
  asignaciones: AsignacionModelo[];
  facturas: FacturaParaModelo[];
  numPerceptoresTrabajo?: number;
  numPerceptoresProfesionales?: number;
}

export function calcular111(input: Calcular111Input): CasillasMap {
  const { asignaciones, facturas } = input;
  const facturasMap = new Map(facturas.map((f) => [f.id, f]));
  const casillas: CasillasMap = {};

  casillas["02"] = input.numPerceptoresTrabajo ?? 0;
  casillas["08"] = input.numPerceptoresProfesionales ?? 0;

  for (const asg of asignaciones) {
    const f = facturasMap.get(asg.factura_id);
    if (!f) continue;
    add(casillas, asg.casilla, asg.importe);
  }

  const totalPercepciones =
    (casillas["01"] ?? 0) +
    (casillas["04"] ?? 0) +
    (casillas["07"] ?? 0) +
    (casillas["10"] ?? 0);
  const totalRetenciones =
    (casillas["03"] ?? 0) +
    (casillas["06"] ?? 0) +
    (casillas["09"] ?? 0) +
    (casillas["12"] ?? 0);

  casillas[CASILLAS_111.TOTAL_PERCEPCIONES] = round2(totalPercepciones);
  casillas[CASILLAS_111.TOTAL_RETENCIONES] = round2(totalRetenciones);
  casillas[CASILLAS_111.RESULTADO] = round2(totalRetenciones);

  return casillas;
}
