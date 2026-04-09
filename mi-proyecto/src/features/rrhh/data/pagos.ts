export interface PagoEmpleado {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
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

function calcularTotal(p: Omit<PagoEmpleado, "id" | "total" | "pagado" | "empleadoId" | "empleadoNombre" | "fijo">): number {
  return p.pago + p.nomina + p.propina + p.horasExtras + p.bonus + p.propinaMantenimiento - p.descuento;
}

const HABANA_PAGOS: PagoEmpleado[] = [
  { id: "hp1", empleadoId: "h1", empleadoNombre: "Carlos Martínez López", fijo: false, pago: 450, nomina: 1200, horasReales: 120, horasTrabajadas: 116, propina: 85, descuento: 30, horasExtras: 60, bonus: 50, propinaMantenimiento: 15, total: 0, pagado: true },
  { id: "hp2", empleadoId: "h2", empleadoNombre: "María García Fernández", fijo: true, pago: 600, nomina: 1800, horasReales: 160, horasTrabajadas: 160, propina: 120, descuento: 0, horasExtras: 0, bonus: 100, propinaMantenimiento: 20, total: 0, pagado: true },
  { id: "hp3", empleadoId: "h3", empleadoNombre: "Alejandro Ruiz Torres", fijo: false, pago: 300, nomina: 800, horasReales: 40, horasTrabajadas: 40, propina: 60, descuento: 0, horasExtras: 0, bonus: 0, propinaMantenimiento: 10, total: 0, pagado: false },
  { id: "hp4", empleadoId: "h4", empleadoNombre: "Laura Sánchez Moreno", fijo: true, pago: 700, nomina: 2200, horasReales: 176, horasTrabajadas: 176, propina: 0, descuento: 0, horasExtras: 40, bonus: 150, propinaMantenimiento: 0, total: 0, pagado: true },
  { id: "hp5", empleadoId: "h5", empleadoNombre: "Pedro Ruiz Navarro", fijo: true, pago: 550, nomina: 1600, horasReales: 144, horasTrabajadas: 140, propina: 90, descuento: 20, horasExtras: 30, bonus: 80, propinaMantenimiento: 15, total: 0, pagado: false },
  { id: "hp6", empleadoId: "h6", empleadoNombre: "Ana López Díaz", fijo: false, pago: 380, nomina: 1000, horasReales: 100, horasTrabajadas: 96, propina: 75, descuento: 15, horasExtras: 20, bonus: 0, propinaMantenimiento: 10, total: 0, pagado: false },
  { id: "hp7", empleadoId: "h7", empleadoNombre: "Javier Fernández Castro", fijo: true, pago: 500, nomina: 1400, horasReales: 160, horasTrabajadas: 160, propina: 0, descuento: 0, horasExtras: 0, bonus: 60, propinaMantenimiento: 25, total: 0, pagado: true },
  { id: "hp8", empleadoId: "h8", empleadoNombre: "Sofía Martín Herrero", fijo: false, pago: 420, nomina: 1100, horasReales: 120, horasTrabajadas: 118, propina: 95, descuento: 10, horasExtras: 15, bonus: 40, propinaMantenimiento: 12, total: 0, pagado: true },
];

const BACANAL_PAGOS: PagoEmpleado[] = [
  { id: "bp1", empleadoId: "b1", empleadoNombre: "Andrés Jiménez Ramos", fijo: true, pago: 750, nomina: 2400, horasReales: 176, horasTrabajadas: 176, propina: 0, descuento: 0, horasExtras: 20, bonus: 200, propinaMantenimiento: 0, total: 0, pagado: true },
  { id: "bp2", empleadoId: "b2", empleadoNombre: "Lucía Pérez Ortega", fijo: true, pago: 580, nomina: 1700, horasReales: 140, horasTrabajadas: 136, propina: 110, descuento: 0, horasExtras: 25, bonus: 90, propinaMantenimiento: 18, total: 0, pagado: false },
  { id: "bp3", empleadoId: "b3", empleadoNombre: "Miguel Santos Gil", fijo: false, pago: 350, nomina: 950, horasReales: 100, horasTrabajadas: 98, propina: 70, descuento: 25, horasExtras: 10, bonus: 0, propinaMantenimiento: 8, total: 0, pagado: false },
  { id: "bp4", empleadoId: "b4", empleadoNombre: "Carmen Morales Reyes", fijo: false, pago: 280, nomina: 700, horasReales: 48, horasTrabajadas: 48, propina: 50, descuento: 0, horasExtras: 0, bonus: 30, propinaMantenimiento: 5, total: 0, pagado: true },
  { id: "bp5", empleadoId: "b5", empleadoNombre: "Raúl Herrera Muñoz", fijo: true, pago: 520, nomina: 1500, horasReales: 140, horasTrabajadas: 135, propina: 0, descuento: 40, horasExtras: 35, bonus: 70, propinaMantenimiento: 0, total: 0, pagado: false },
  { id: "bp6", empleadoId: "b6", empleadoNombre: "Isabel Domínguez Lara", fijo: true, pago: 480, nomina: 1300, horasReales: 140, horasTrabajadas: 140, propina: 0, descuento: 0, horasExtras: 0, bonus: 50, propinaMantenimiento: 0, total: 0, pagado: true },
];

function computeTotals(pagos: PagoEmpleado[]): PagoEmpleado[] {
  return pagos.map(p => ({
    ...p,
    total: p.pago + p.nomina + p.propina + p.horasExtras + p.bonus + p.propinaMantenimiento - p.descuento,
  }));
}

export function getPagosPorEmpresa(empresaId: string): PagoEmpleado[] {
  if (empresaId === "habana") return computeTotals(HABANA_PAGOS);
  if (empresaId === "bacanal") return computeTotals(BACANAL_PAGOS);
  return [];
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
