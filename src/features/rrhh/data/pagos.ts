export type PagoArea = "administrativa" | "operativa";

export interface PagoEmpleado {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
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
  total: number;
  pagado: boolean;
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
  const totalFinal = pagos.reduce((s, p) => s + p.total, 0);
  const positivo = totalPagos + totalPropinas + totalExtras + totalBonus + ajustesPositivos;
  const negativo = ajustesNegativos;
  const efectivoAhorro = totalFinal - totalNomina;
  const prestamos = Math.round(ajustesNegativos * 0.4);
  const propinasAcumuladas = totalPropinas + pagos.reduce((s, p) => s + p.propinaMantenimiento, 0);

  return { totalPagos, totalNomina, totalPropinas, totalAjustes, totalExtras, totalBonus, totalFinal, positivo, negativo, efectivoAhorro, prestamos, propinasAcumuladas };
}
