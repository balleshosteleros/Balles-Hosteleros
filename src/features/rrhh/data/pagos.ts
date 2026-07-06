export type PagoArea = "administrativa" | "operativa";

export interface PagoEmpleado {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  // DNI/NIE de la ficha del empleado (para emparejar nóminas y mostrarlo en la
  // tabla). null si el empleado no lo tiene registrado o es un ex-empleado suelto.
  dniNie: string | null;
  area: PagoArea;
  fijo: boolean;
  pago: number;
  nomina: number;
  horasReales: number;
  horasTrabajadas: number;
  propina: number;
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
  // Confirmacion de liquidacion: enviada -> bloqueada; aceptada -> el empleado la
  // acepto desde su app. ISO string o null.
  confirmacionEnviadaAt: string | null;
  confirmacionAceptadaAt: string | null;
}

export interface ResumenPagos {
  totalPagos: number;
  totalNomina: number;
  totalPropinas: number;
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
  propinasAcumuladas: number;
}

export function calcularTotalPago(p: PagoEmpleado): number {
  return p.pago + p.nomina + p.propina + p.horasExtras + p.bonus + p.propinaMantenimiento + p.ajuste;
}

export function getResumenPagos(pagos: PagoEmpleado[]): ResumenPagos {
  const totalPagos = pagos.reduce((s, p) => s + p.pago, 0);
  const totalNomina = pagos.reduce((s, p) => s + p.nomina, 0);
  const totalPropinas = pagos.reduce((s, p) => s + p.propina, 0);
  const totalAjustes = pagos.reduce((s, p) => s + p.ajuste, 0);
  const ajustesPositivos = pagos.reduce((s, p) => s + Math.max(0, p.ajuste), 0);
  const ajustesNegativos = pagos.reduce((s, p) => s + Math.max(0, -p.ajuste), 0);
  const totalExtras = pagos.reduce((s, p) => s + p.horasExtras, 0);
  const totalBonus = pagos.reduce((s, p) => s + p.bonus, 0);
  const totalSsEmpleado = pagos.reduce((s, p) => s + p.ssEmpleado, 0);
  const totalSsEmpresa = pagos.reduce((s, p) => s + p.ssEmpresa, 0);
  const totalSs = totalSsEmpleado + totalSsEmpresa;
  const totalFinal = pagos.reduce((s, p) => s + p.total, 0);
  const positivo = totalPagos + totalPropinas + totalExtras + totalBonus + ajustesPositivos;
  const negativo = ajustesNegativos;
  const efectivoAhorro = totalFinal - totalNomina;
  const prestamos = Math.round(ajustesNegativos * 0.4);
  const propinasAcumuladas = totalPropinas + pagos.reduce((s, p) => s + p.propinaMantenimiento, 0);

  return { totalPagos, totalNomina, totalPropinas, totalAjustes, totalExtras, totalBonus, totalSsEmpleado, totalSsEmpresa, totalSs, totalFinal, positivo, negativo, efectivoAhorro, prestamos, propinasAcumuladas };
}

/** Coste total de Seguridad Social de un pago (empleado + empresa). Informativo. */
export function costeSSTotal(p: PagoEmpleado): number {
  return Math.round((p.ssEmpleado + p.ssEmpresa) * 100) / 100;
}
