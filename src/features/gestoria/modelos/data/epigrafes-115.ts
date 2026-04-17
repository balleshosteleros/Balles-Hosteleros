/**
 * Catálogo oficial del Modelo 115
 * (Retenciones sobre rentas procedentes de arrendamiento de inmuebles urbanos).
 * Ejercicio 2026 · retención 19 %.
 */
import type { Epigrafe } from "../types/modelos";

export const EPIGRAFES_115: Epigrafe[] = [
  {
    codigo: "ALQUILER_LOCAL",
    etiqueta: "Alquiler local de negocio",
    descripcion: "Rentas pagadas por el alquiler del local comercial con retención 19 %",
    casillaBase: "02",
    casillaRetencion: "03",
    aplicaA: ["COMPRA"],
    palabrasClave: ["alquiler", "arrendamiento", "renta", "local", "nave"],
  },
];

export const CASILLAS_115 = {
  NUM_PERCEPTORES: "01",
  BASE_RETENCIONES: "02",
  IMPORTE_RETENCIONES: "03",
  RESULTADO: "06",
} as const;
