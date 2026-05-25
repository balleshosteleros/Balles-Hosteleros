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
  descuento: number;
  horasExtras: number;
  bonus: number;
  propinaMantenimiento: number;
  total: number;
  pagado: boolean;
}

export interface ResumenPagos {
  totalPagos: number;
  totalNomina: number;
  totalPropinas: number;
  totalDescuentos: number;
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
  return p.pago + p.nomina + p.propina + p.horasExtras + p.bonus + p.propinaMantenimiento - p.descuento;
}

export function getResumenPagos(pagos: PagoEmpleado[]): ResumenPagos {
  const totalPagos = pagos.reduce((s, p) => s + p.pago, 0);
  const totalNomina = pagos.reduce((s, p) => s + p.nomina, 0);
  const totalPropinas = pagos.reduce((s, p) => s + p.propina, 0);
  const totalDescuentos = pagos.reduce((s, p) => s + p.descuento, 0);
  const totalExtras = pagos.reduce((s, p) => s + p.horasExtras, 0);
  const totalBonus = pagos.reduce((s, p) => s + p.bonus, 0);
  const totalFinal = pagos.reduce((s, p) => s + p.total, 0);
  const positivo = totalPagos + totalPropinas + totalExtras + totalBonus;
  const negativo = totalDescuentos;
  const efectivoAhorro = totalFinal - totalNomina;
  const prestamos = Math.round(totalDescuentos * 0.4);
  const propinasAcumuladas = totalPropinas + pagos.reduce((s, p) => s + p.propinaMantenimiento, 0);

  return { totalPagos, totalNomina, totalPropinas, totalDescuentos, totalExtras, totalBonus, totalFinal, positivo, negativo, efectivoAhorro, prestamos, propinasAcumuladas };
}
