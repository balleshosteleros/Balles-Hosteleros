/**
 * Catálogo oficial de epígrafes del Modelo 303 (IVA trimestral).
 * Fuente: Orden HAC/646/2021, modificaciones hasta ejercicio 2026.
 * Régimen general (sin recargo de equivalencia).
 */
import type { Epigrafe } from "../types/modelos";

export const EPIGRAFES_303: Epigrafe[] = [
  {
    codigo: "VENTAS_21",
    etiqueta: "Ventas IVA general 21 %",
    descripcion: "Entregas de bienes y prestaciones de servicios a tipo general",
    casillaBase: "01",
    casillaCuota: "03",
    aplicaA: ["VENTA"],
    tipoIva: 21,
  },
  {
    codigo: "VENTAS_10",
    etiqueta: "Ventas IVA reducido 10 %",
    descripcion: "Hostelería, restauración, transporte de viajeros, hoteles",
    casillaBase: "04",
    casillaCuota: "06",
    aplicaA: ["VENTA"],
    tipoIva: 10,
    palabrasClave: ["menú", "restaurante", "bar", "hotel", "alojamiento"],
  },
  {
    codigo: "VENTAS_4",
    etiqueta: "Ventas IVA superreducido 4 %",
    descripcion: "Pan, leche, huevos, frutas, verduras, libros",
    casillaBase: "07",
    casillaCuota: "09",
    aplicaA: ["VENTA"],
    tipoIva: 4,
  },
  {
    codigo: "VENTAS_0",
    etiqueta: "Ventas exentas / 0 %",
    descripcion: "Operaciones exentas con derecho a deducción",
    casillaBase: "60",
    aplicaA: ["VENTA"],
    tipoIva: 0,
  },
  {
    codigo: "COMPRAS_INTERIOR_BIENES",
    etiqueta: "IVA soportado · bienes corrientes interior",
    descripcion: "Compras corrientes nacionales de bienes y servicios",
    casillaBase: "28",
    casillaCuota: "29",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
    palabrasClave: [
      "materia prima",
      "ingredientes",
      "carne",
      "pescado",
      "verdura",
      "bebidas",
      "suministros",
    ],
  },
  {
    codigo: "COMPRAS_INTERIOR_INVERSION",
    etiqueta: "IVA soportado · bienes de inversión interior",
    descripcion: "Compras de bienes de inversión (mobiliario, maquinaria, vehículos)",
    casillaBase: "30",
    casillaCuota: "31",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
    palabrasClave: [
      "horno",
      "cámara",
      "congelador",
      "vehículo",
      "furgoneta",
      "mobiliario",
      "equipo",
      "maquinaria",
    ],
  },
  {
    codigo: "IMPORTACIONES_BIENES",
    etiqueta: "IVA soportado · importaciones bienes corrientes",
    descripcion: "Importaciones de fuera UE",
    casillaBase: "32",
    casillaCuota: "33",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
  },
  {
    codigo: "IMPORTACIONES_INVERSION",
    etiqueta: "IVA soportado · importaciones bienes de inversión",
    descripcion: "Importaciones fuera UE bienes de inversión",
    casillaBase: "34",
    casillaCuota: "35",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
  },
  {
    codigo: "ADQ_INTRACOM_BIENES",
    etiqueta: "IVA soportado · adquisiciones intracomunitarias bienes",
    descripcion: "Adquisiciones UE bienes corrientes",
    casillaBase: "36",
    casillaCuota: "37",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
  },
  {
    codigo: "ADQ_INTRACOM_INVERSION",
    etiqueta: "IVA soportado · adquisiciones intracomunitarias inversión",
    descripcion: "Adquisiciones UE bienes de inversión",
    casillaBase: "38",
    casillaCuota: "39",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
  },
  {
    codigo: "RECTIFICATIVAS_DEDUCIBLES",
    etiqueta: "Rectificaciones de deducciones",
    descripcion: "Facturas rectificativas de compra (signo negativo)",
    casillaBase: "40",
    casillaCuota: "41",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
  },
];

export const CASILLAS_303_RESULTADO = {
  TOTAL_BASE_IVA_REPERCUTIDO: "27",
  TOTAL_CUOTA_IVA_REPERCUTIDO: "27b",
  TOTAL_CUOTA_DEVENGADA: "27",
  TOTAL_IVA_DEDUCIBLE: "45",
  RESULTADO_REGIMEN_GENERAL: "46",
  RESULTADO_LIQUIDACION: "69",
  A_COMPENSAR: "72",
  A_INGRESAR: "71",
  A_DEVOLVER: "73",
} as const;

export function epigrafeCasillaBase(codigo: string): string | null {
  return EPIGRAFES_303.find((e) => e.codigo === codigo)?.casillaBase ?? null;
}
