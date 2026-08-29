export type PagoArea = "administrativa" | "operativa";

/**
 * Una nómina individual del mes. Un empleado puede tener varias (p.ej. finiquito +
 * nómina normal): `rrhh_pagos` guarda la SUMA y esto es lo que aporta cada una,
 * para poder abrir el desglose desde cualquier columna de importe.
 */
export interface DetalleNomina {
  orden: number;
  neto: number;
  ssEmpleado: number;
  ssEmpresa: number;
  irpf: number;
  /** Texto de incidencia si la IA no pudo leerla bien (p.ej. neto a 0). */
  incidencia: string | null;
}

export interface PagoEmpleado {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  // DNI/NIE de la ficha del empleado (para emparejar nóminas y mostrarlo en la
  // tabla). null si el empleado no lo tiene registrado o es un ex-empleado suelto.
  dniNie: string | null;
  // Puesto de la ficha del empleado. null en ex-empleados sueltos (sin ficha).
  puesto: string | null;
  area: PagoArea;
  fijo: boolean;
  pago: number;
  nomina: number;
  horasReales: number;
  horasTrabajadas: number;
  complemento: number;
  ajuste: number; // manual con signo: + suma al total, − resta (antes "descuento")
  horasExtras: number;
  bonus: number;
  propinaMantenimiento: number;
  // Coste de Seguridad Social. INFORMATIVO: no entra en el `total` del pago.
  ssEmpleado: number; // lo que paga el trabajador (descontado de su nómina)
  ssEmpresa: number; // lo que paga la empresa por el trabajador
  irpf: number; // retención de IRPF del trabajador (informativa, no toca el total)
  total: number;
  pagado: boolean;
  // Path en Storage (bucket rrhh-nominas) de la nómina original de este empleado
  // y periodo, o null si aún no se ha adjuntado. La columna "Nómina" muestra un
  // enlace para verla (URL firmada temporal).
  nominaPath: string | null;
  // Nº de nóminas individuales de este empleado en el mes (1 normal; 2+ si tiene
  // varias, p.ej. finiquito + normal). Sirve para el badge con el número.
  numNominas: number;
  // Las nóminas individuales del mes (ordenadas). Con 2+, cada columna de importe
  // muestra el círculo con el número y abre el desglose al pulsarlo. Derivado de
  // `rrhh_pagos_nominas`: no se persiste con el pago.
  detalleNominas?: DetalleNomina[];
  // true si alguna nómina del mes se subió cuando el empleado YA estaba Inactivo.
  // Pinta un aviso de peligro para revisar si de verdad le corresponde cobrar. Se
  // sella al subir: una baja POSTERIOR no marca la nómina retroactivamente.
  avisoInactivo: boolean;
  // Confirmacion de liquidacion: enviada -> bloqueada; aceptada -> el empleado la
  // acepto desde su app. ISO string o null.
  confirmacionEnviadaAt: string | null;
  confirmacionAceptadaAt: string | null;
}

export interface ResumenPagos {
  totalPagos: number;
  totalNomina: number;
  totalComplementos: number;
  totalAjustes: number; // suma con signo de los ajustes
  totalExtras: number;
  totalBonus: number;
  totalSsEmpleado: number;
  totalSsEmpresa: number;
  totalSs: number; // empleado + empresa
  totalFinal: number;
  positivo: number;
  negativo: number;
  efectivoAhorro: number;
  prestamos: number;
  complementosAcumulados: number;
}

export function calcularTotalPago(p: PagoEmpleado): number {
  return p.pago + p.nomina + p.complemento + p.horasExtras + p.bonus + p.propinaMantenimiento + p.ajuste;
}

export function getResumenPagos(pagos: PagoEmpleado[]): ResumenPagos {
  const totalPagos = pagos.reduce((s, p) => s + p.pago, 0);
  const totalNomina = pagos.reduce((s, p) => s + p.nomina, 0);
  const totalComplementos = pagos.reduce((s, p) => s + p.complemento, 0);
  const totalAjustes = pagos.reduce((s, p) => s + p.ajuste, 0);
  const ajustesPositivos = pagos.reduce((s, p) => s + Math.max(0, p.ajuste), 0);
  const ajustesNegativos = pagos.reduce((s, p) => s + Math.max(0, -p.ajuste), 0);
  const totalExtras = pagos.reduce((s, p) => s + p.horasExtras, 0);
  const totalBonus = pagos.reduce((s, p) => s + p.bonus, 0);
  const totalSsEmpleado = pagos.reduce((s, p) => s + p.ssEmpleado, 0);
  const totalSsEmpresa = pagos.reduce((s, p) => s + p.ssEmpresa, 0);
  const totalSs = totalSsEmpleado + totalSsEmpresa;
  const totalFinal = pagos.reduce((s, p) => s + p.total, 0);
  const positivo = totalPagos + totalComplementos + totalExtras + totalBonus + ajustesPositivos;
  const negativo = ajustesNegativos;
  const efectivoAhorro = totalFinal - totalNomina;
  const prestamos = Math.round(ajustesNegativos * 0.4);
  const complementosAcumulados = totalComplementos + pagos.reduce((s, p) => s + p.propinaMantenimiento, 0);

  return { totalPagos, totalNomina, totalComplementos, totalAjustes, totalExtras, totalBonus, totalSsEmpleado, totalSsEmpresa, totalSs, totalFinal, positivo, negativo, efectivoAhorro, prestamos, complementosAcumulados };
}

/** Coste total de Seguridad Social de un pago (empleado + empresa). Informativo. */
export function costeSSTotal(p: PagoEmpleado): number {
  return Math.round((p.ssEmpleado + p.ssEmpresa) * 100) / 100;
}

// ── Desglose bruto → neto de la nómina ──────────────────────────────────────
// El sistema guarda el NETO (`nomina` = líquido a percibir, leído de la nómina
// por la IA). El BRUTO no se almacena, pero se RECONSTRUYE sumando al neto las
// retenciones que se le descuentan al trabajador: SS del empleado + IRPF.
//   bruto = neto + ss_empleado + irpf
// Así el desglose queda: Bruto  −SS(trabajador)  −IRPF  = Neto.

/** Nómina NETA (líquido a percibir). Es el valor guardado en `nomina`. */
export function nominaNeta(p: Pick<PagoEmpleado, "nomina">): number {
  return Math.round(p.nomina * 100) / 100;
}

/** Nómina BRUTA reconstruida = neto + SS del trabajador + IRPF. */
export function nominaBruta(p: Pick<PagoEmpleado, "nomina" | "ssEmpleado" | "irpf">): number {
  return Math.round((p.nomina + p.ssEmpleado + p.irpf) * 100) / 100;
}
