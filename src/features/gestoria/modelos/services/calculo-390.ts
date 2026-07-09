/**
 * Motor de cálculo puro del Modelo 390 (Resumen anual IVA).
 * Consolida los 4 trimestres del 303.
 */
import type { CasillasMap } from "../types/modelos";
import { CASILLAS_390, MAPPING_303_A_390 } from "../data/epigrafes-390";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface Calcular390Input {
  trimestres: Array<{
    periodo: "T1" | "T2" | "T3" | "T4";
    casillas: CasillasMap;
  }>;
}

export function calcular390(input: Calcular390Input): CasillasMap {
  const casillas: CasillasMap = {};

  for (const [casilla303, casilla390] of Object.entries(MAPPING_303_A_390)) {
    const suma = input.trimestres.reduce(
      (acc, t) => acc + (t.casillas[casilla303] ?? 0),
      0,
    );
    casillas[casilla390] = round2(suma);
  }

  const totalBasesRepercutido =
    (casillas[CASILLAS_390.REGIMEN_GENERAL.BASE_21] ?? 0) +
    (casillas[CASILLAS_390.REGIMEN_GENERAL.BASE_10] ?? 0) +
    (casillas[CASILLAS_390.REGIMEN_GENERAL.BASE_4] ?? 0);
  const totalCuotasRepercutido =
    (casillas[CASILLAS_390.REGIMEN_GENERAL.CUOTA_21] ?? 0) +
    (casillas[CASILLAS_390.REGIMEN_GENERAL.CUOTA_10] ?? 0) +
    (casillas[CASILLAS_390.REGIMEN_GENERAL.CUOTA_4] ?? 0);

  casillas[CASILLAS_390.REGIMEN_GENERAL.TOTAL_BASES] = round2(totalBasesRepercutido);
  casillas[CASILLAS_390.REGIMEN_GENERAL.TOTAL_CUOTAS] = round2(totalCuotasRepercutido);

  const totalBasesDeducible =
    (casillas[CASILLAS_390.DEDUCIBLE.INTERIOR_BIENES_BASE] ?? 0) +
    (casillas[CASILLAS_390.DEDUCIBLE.INTERIOR_INVERSION_BASE] ?? 0) +
    (casillas[CASILLAS_390.DEDUCIBLE.IMPORTACIONES_BASE] ?? 0) +
    (casillas[CASILLAS_390.DEDUCIBLE.INTRACOM_BASE] ?? 0);
  const totalCuotasDeducible =
    (casillas[CASILLAS_390.DEDUCIBLE.INTERIOR_BIENES_CUOTA] ?? 0) +
    (casillas[CASILLAS_390.DEDUCIBLE.INTERIOR_INVERSION_CUOTA] ?? 0) +
    (casillas[CASILLAS_390.DEDUCIBLE.IMPORTACIONES_CUOTA] ?? 0) +
    (casillas[CASILLAS_390.DEDUCIBLE.INTRACOM_CUOTA] ?? 0);

  casillas[CASILLAS_390.DEDUCIBLE.TOTAL_BASES_DEDUCIBLE] = round2(totalBasesDeducible);
  casillas[CASILLAS_390.DEDUCIBLE.TOTAL_CUOTAS_DEDUCIBLE] = round2(totalCuotasDeducible);

  casillas[CASILLAS_390.RESULTADO.REGIMEN_GENERAL_DEVENGADO] = round2(totalCuotasRepercutido);
  casillas[CASILLAS_390.RESULTADO.TOTAL_DEDUCIBLE] = round2(totalCuotasDeducible);
  casillas[CASILLAS_390.RESULTADO.LIQUIDACION_ANUAL] = round2(
    totalCuotasRepercutido - totalCuotasDeducible,
  );
  casillas[CASILLAS_390.RESULTADO.RESULTADO] =
    casillas[CASILLAS_390.RESULTADO.LIQUIDACION_ANUAL];

  return casillas;
}
