/**
 * Catálogo oficial de epígrafes del Modelo 130
 * (Pago fraccionado IRPF · estimación directa · actividades empresariales).
 * Ejercicio 2026.
 */
import type { Epigrafe } from "../types/modelos";

export const EPIGRAFES_130: Epigrafe[] = [
  {
    codigo: "INGRESOS_ACTIVIDAD",
    etiqueta: "Ingresos computables actividad económica",
    descripcion: "Ventas y prestaciones (excluido IVA)",
    casillaBase: "01",
    aplicaA: ["VENTA"],
    tipoIva: "cualquiera",
  },
  {
    codigo: "GASTOS_ACTIVIDAD",
    etiqueta: "Gastos deducibles actividad económica",
    descripcion: "Compras y gastos deducibles (excluido IVA)",
    casillaBase: "02",
    aplicaA: ["COMPRA"],
    tipoIva: "cualquiera",
  },
  {
    codigo: "RETENCIONES_SOPORTADAS",
    etiqueta: "Retenciones soportadas sobre ingresos",
    descripcion: "Retenciones IRPF aplicadas por clientes profesionales",
    casillaBase: "06",
    aplicaA: ["VENTA"],
  },
];

export const CASILLAS_130 = {
  INGRESOS: "01",
  GASTOS: "02",
  RENDIMIENTO_NETO: "03",
  PORCENTAJE: "04",
  PAGO_FRACCIONADO: "07",
  PAGOS_ANTERIORES_TRIMESTRE: "08",
  RETENCIONES: "06",
  RESULTADO: "19",
} as const;

export const PORCENTAJE_PAGO_FRACCIONADO_130 = 20;
