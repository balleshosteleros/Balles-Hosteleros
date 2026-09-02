/**
 * Cálculo ÚNICO del desglose que ve el trabajador en su nómina.
 *
 * El sistema guarda el NETO (es lo que la IA lee del recibo), nunca el bruto:
 * el bruto se reconstruye sumando lo que se le retiene. Este módulo es la única
 * fuente de esa aritmética, para que las tres superficies donde el empleado ve
 * su dinero digan exactamente lo mismo:
 *
 *   1. Portal "Mis pagos"            → HistorialPagos.tsx
 *   2. Web de confirmación por token → ConfirmarLiquidacionView.tsx
 *   3. Correo de liquidación         → rrhh-pagos-confirmacion.ts
 *
 * Las tres calculaban el bruto y el coste de empresa por su cuenta; ahora
 * consumen esto.
 */

/** Redondeo a céntimos: los importes se muestran y se suman a 2 decimales. */
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Los importes crudos de un pago, tal cual salen de `rrhh_pagos`. */
export interface ImportesPago {
  /** Nómina NETA del mes (lo que el recibo llama "líquido a percibir"). */
  nomina: number;
  /** Seguridad Social a cargo del TRABAJADOR: se le descuenta de la nómina. */
  ssEmpleado: number;
  /** Retención de IRPF practicada al trabajador. */
  irpf: number;
  /** Seguridad Social a cargo de la EMPRESA: NO se le descuenta a él. */
  ssEmpresa: number;
  /** Total que percibe el trabajador (nómina neta + extras del mes). */
  total: number;
}

export interface DesgloseNomina {
  /** Nómina bruta = neto + SS del trabajador + IRPF. */
  bruto: number;
  ssEmpleado: number;
  irpf: number;
  /** Todo lo que se le retiene del bruto (SS trabajador + IRPF). */
  totalRetenido: number;
  /** Nómina neta: lo que queda tras las retenciones. */
  neto: number;
  /** Lo que percibe finalmente (neto + complementos, extras, bonus, ajuste). */
  total: number;
  /** SS a cargo de la empresa (aportación patronal). */
  ssEmpresa: number;
  /** SS cotizada en total por ese trabajador: su parte + la de la empresa. */
  ssTotal: number;
  /** Coste real del trabajador para la empresa. */
  costeEmpresa: number;
  /** % que la SS patronal supone sobre el bruto; null si no hay bruto. */
  porcentajeSsEmpresa: number | null;
  /** true si hay algo que contar sobre el coste de empresa (evita bloques vacíos). */
  hayCosteEmpresa: boolean;
}

/**
 * Reconstruye el desglose completo a partir de los importes guardados.
 *
 * Coste para la empresa = lo que el trabajador percibe + lo que se le retiene
 * (SS trabajador + IRPF, que la empresa ingresa en su nombre a la Seguridad
 * Social y a Hacienda) + la SS a cargo de la empresa. Es decir: todo el dinero
 * que sale de la empresa por ese trabajador ese mes.
 */
export function calcularDesgloseNomina(p: ImportesPago): DesgloseNomina {
  const ssEmpleado = p.ssEmpleado || 0;
  const irpf = p.irpf || 0;
  const ssEmpresa = p.ssEmpresa || 0;
  const neto = p.nomina || 0;
  const total = p.total || 0;

  const bruto = r2(neto + ssEmpleado + irpf);
  const costeEmpresa = r2(total + ssEmpleado + irpf + ssEmpresa);

  return {
    bruto,
    ssEmpleado,
    irpf,
    totalRetenido: r2(ssEmpleado + irpf),
    neto,
    total,
    ssEmpresa,
    ssTotal: r2(ssEmpleado + ssEmpresa),
    costeEmpresa,
    porcentajeSsEmpresa: bruto > 0 && ssEmpresa > 0 ? r2((ssEmpresa / bruto) * 100) : null,
    hayCosteEmpresa: costeEmpresa > total,
  };
}

/**
 * Los conceptos que la empresa cotiza a la Seguridad Social por el trabajador.
 *
 * Las nóminas españolas desglosan la aportación patronal en contingencias
 * comunes, desempleo, FOGASA, formación profesional y accidentes de trabajo,
 * pero de la nómina solo se extrae el TOTAL de la aportación empresarial: los
 * conceptos por separado no aparecen en el recibo del trabajador, están en el
 * recibo de cotización de la empresa. Por eso aquí NO se inventa un reparto por
 * porcentajes: se explica en palabras qué incluye ese total.
 *
 * Regla del proyecto: 0 € calculado ≠ dato sin calcular. Si no hay SS de
 * empresa leída, el bloque no se pinta en lugar de mostrar ceros.
 */
export const CONCEPTOS_SS_EMPRESA =
  "contingencias comunes, desempleo, FOGASA, formación profesional y accidentes de trabajo";
