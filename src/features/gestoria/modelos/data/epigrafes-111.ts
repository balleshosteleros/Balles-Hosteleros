/**
 * Catálogo oficial del Modelo 111
 * (Retenciones e ingresos a cuenta · rendimientos trabajo y actividades profesionales).
 * Ejercicio 2026.
 */
import type { Epigrafe } from "../types/modelos";

export const EPIGRAFES_111: Epigrafe[] = [
  {
    codigo: "TRABAJO_DINERARIO",
    etiqueta: "Rendimientos del trabajo · dinerarios",
    descripcion: "Nóminas de empleados (base sujeta a retención)",
    casillaBase: "01",
    casillaRetencion: "03",
    aplicaA: ["COMPRA"],
    palabrasClave: ["nómina", "salario", "sueldo"],
  },
  {
    codigo: "TRABAJO_ESPECIE",
    etiqueta: "Rendimientos del trabajo · en especie",
    descripcion: "Retribuciones en especie a empleados",
    casillaBase: "04",
    casillaRetencion: "06",
    aplicaA: ["COMPRA"],
  },
  {
    codigo: "PROFESIONALES_DINERARIO",
    etiqueta: "Rendimientos profesionales · dinerarios",
    descripcion: "Facturas de profesionales con retención IRPF 15 % (o 7 % reducida)",
    casillaBase: "07",
    casillaRetencion: "09",
    aplicaA: ["COMPRA"],
    palabrasClave: ["honorarios", "profesional", "abogado", "asesor", "consultor", "diseño"],
  },
  {
    codigo: "PROFESIONALES_ESPECIE",
    etiqueta: "Rendimientos profesionales · en especie",
    descripcion: "Retribuciones en especie a profesionales",
    casillaBase: "10",
    casillaRetencion: "12",
    aplicaA: ["COMPRA"],
  },
];

export const CASILLAS_111 = {
  TOTAL_PERCEPCIONES: "25",
  TOTAL_RETENCIONES: "27",
  RESULTADO: "28",
} as const;
