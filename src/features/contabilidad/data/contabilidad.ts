/* ── Contabilidad shared data & types ── */

export type TipoContacto = "EMPRESA" | "AUTONOMO" | "PARTICULAR";
export type EstadoFactura = "PENDIENTE" | "PAGADO" | "VENCIDO" | "COBRADO";
export type TipoFactura = "COMPRA" | "VENTA";
export type TipoOperacion = "ENTRADA" | "SALIDA";
export type TipoTransaccion = "COBRO" | "PAGO";
export type EstadoConciliacion = "CONCILIADA" | "SIN_CONCILIAR";
export type Periodicidad = "MENSUAL" | "TRIMESTRAL" | "ANUAL" | "PUNTUAL" | "SEMANAL";
export type SincBanco = "MANUAL" | "AUTOMATICA";

export interface ContactoContable {
  id: string;
  nombre: string;
  tipo: TipoContacto;
  documento: string;
  email: string;
  etiquetas: string[];
  categoria: string;
  observaciones: string;
  telefono?: string;
  direccion?: string;
  notas?: string;
}

export interface OperacionContable {
  id: string;
  descripcion: string;
  contacto: string;
  periodicidad: Periodicidad;
  fechaInicio: string;
  fechaFin: string;
  total: number;
  tipo: TipoOperacion;
  etiquetas: string[];
}

export interface FacturaContable {
  id: string;
  tipo: TipoFactura;
  cliente: string;
  numeroFactura: string;
  tipoFactura: string;
  fechaEmision: string;
  fechaPago: string;
  estado: EstadoFactura;
  total: number;
  diasTarde?: number;
}

export interface TransaccionContable {
  id: string;
  concepto: string;
  banco: string;
  fecha: string;
  importe: number;
  tipo: TipoTransaccion;
  etiquetas: { categoria: string; detalle: string; color: string }[];
  documentos: number;
  conciliada: boolean;
}

export interface ConciliacionItem {
  id: string;
  transaccion: string;
  banco: string;
  fecha: string;
  importe: number;
  facturaAsociada: string;
  emision: string;
  totalIva: string;
  conciliada: boolean;
}

export interface BancoConectado {
  id: string;
  nombre: string;
  productos: number;
  sincronizacion: SincBanco;
  ultimaSync: string;
  color: string;
}

// ── SAMPLE DATA ──

export const SAMPLE_CONTACTOS: ContactoContable[] = [
  { id: "c1", nombre: "4en1", tipo: "EMPRESA", documento: "", email: "", etiquetas: [], categoria: "Proveedor", observaciones: "" },
  { id: "c2", nombre: "ADYEN", tipo: "EMPRESA", documento: "", email: "", etiquetas: ["INTERESES TARJETA"], categoria: "Servicios", observaciones: "" },
  { id: "c3", nombre: "AGEDI-AIE", tipo: "EMPRESA", documento: "U87711904", email: "contigo@agedi-aie.es", etiquetas: [], categoria: "Proveedor", observaciones: "" },
  { id: "c4", nombre: "AGORA", tipo: "EMPRESA", documento: "AP", email: "", etiquetas: ["AGORA", "IICTPV"], categoria: "Servicios", observaciones: "" },
  { id: "c5", nombre: "Alcampo S.A.", tipo: "EMPRESA", documento: "A28581882", email: "", etiquetas: [], categoria: "Proveedor", observaciones: "" },
  { id: "c6", nombre: "ALFAROTECA", tipo: "EMPRESA", documento: "", email: "", etiquetas: [], categoria: "Proveedor", observaciones: "" },
  { id: "c7", nombre: "ALIEXPRESS", tipo: "EMPRESA", documento: "", email: "", etiquetas: [], categoria: "Proveedor", observaciones: "" },
  { id: "c8", nombre: "ALQUILER", tipo: "EMPRESA", documento: "SOCIEDAD", email: "", etiquetas: ["PALGRAPHIC"], categoria: "Gastos fijos", observaciones: "" },
  { id: "c9", nombre: "AMAZON", tipo: "EMPRESA", documento: "-", email: "", etiquetas: ["AMAZON", "AMZN"], categoria: "Proveedor", observaciones: "" },
  { id: "c10", nombre: "Asesoría ONJ", tipo: "AUTONOMO", documento: "BAC03/26", email: "olga@onj.es", etiquetas: [], categoria: "Asesoría", observaciones: "" },
  { id: "c11", nombre: "Juan Pérez López", tipo: "PARTICULAR", documento: "12345678A", email: "juan@email.com", etiquetas: [], categoria: "Cliente", observaciones: "" },
];

export const SAMPLE_OPERACIONES: OperacionContable[] = [
  { id: "o1", descripcion: "pAGO ADYEN", contacto: "ADYEN", periodicidad: "MENSUAL", fechaInicio: "2026-01-01", fechaFin: "", total: 100, tipo: "SALIDA", etiquetas: [] },
  { id: "o2", descripcion: "ALQUILER LOCAL", contacto: "ALQUILER", periodicidad: "MENSUAL", fechaInicio: "2025-01-01", fechaFin: "", total: 2420, tipo: "SALIDA", etiquetas: ["PALGRAPHIC"] },
  { id: "o3", descripcion: "NÓMINAS PERSONAL", contacto: "", periodicidad: "MENSUAL", fechaInicio: "2025-01-01", fechaFin: "", total: 8500, tipo: "SALIDA", etiquetas: ["Personal"] },
  { id: "o4", descripcion: "SEGURO LOCAL", contacto: "AXA Seguros", periodicidad: "ANUAL", fechaInicio: "2026-01-15", fechaFin: "2027-01-15", total: 1200, tipo: "SALIDA", etiquetas: [] },
  { id: "o5", descripcion: "FACTURACIÓN AGORA", contacto: "AGORA", periodicidad: "MENSUAL", fechaInicio: "2025-06-01", fechaFin: "", total: 4500, tipo: "ENTRADA", etiquetas: ["TPV"] },
];

export const SAMPLE_FACTURAS: FacturaContable[] = [
  { id: "f1", tipo: "COMPRA", cliente: "ALQUILER", numeroFactura: "AF26-411", tipoFactura: "Ordinaria", fechaEmision: "7/4/2026", fechaPago: "15/4/2026", estado: "PENDIENTE", total: -2420 },
  { id: "f2", tipo: "COMPRA", cliente: "Atenco Energía, SL", numeroFactura: "FAT-2026-054966", tipoFactura: "Ordinaria", fechaEmision: "7/4/2026", fechaPago: "17/4/2026", estado: "PENDIENTE", total: -1059.48 },
  { id: "f3", tipo: "COMPRA", cliente: "IGT Microelectrónicos, S.L.", numeroFactura: "F1-8515-2026", tipoFactura: "Ordinaria", fechaEmision: "2/4/2026", fechaPago: "30/3/2026", estado: "VENCIDO", total: -193.52, diasTarde: 6 },
  { id: "f4", tipo: "COMPRA", cliente: "KM Plagas 2009, S.L.", numeroFactura: "425/2026", tipoFactura: "Ordinaria", fechaEmision: "1/4/2026", fechaPago: "1/5/2026", estado: "PAGADO", total: -89.54 },
  { id: "f5", tipo: "COMPRA", cliente: "Digitalent Creativity S.L.", numeroFactura: "FR2026_200", tipoFactura: "Ordinaria", fechaEmision: "1/4/2026", fechaPago: "7/4/2026", estado: "PENDIENTE", total: -907.50 },
  { id: "f6", tipo: "COMPRA", cliente: "Restaurant Booking & Distribution Services", numeroFactura: "2026025976", tipoFactura: "Ordinaria", fechaEmision: "31/3/2026", fechaPago: "6/4/2026", estado: "VENCIDO", total: -306.86, diasTarde: 3 },
  { id: "f7", tipo: "COMPRA", cliente: "COVER MANAGER", numeroFactura: "2026025977", tipoFactura: "Ordinaria", fechaEmision: "31/3/2026", fechaPago: "6/4/2026", estado: "VENCIDO", total: -59.88, diasTarde: 8 },
  { id: "f8", tipo: "COMPRA", cliente: "Asesoría ONJ - Olga Navas Jerez", numeroFactura: "BAC03/26", tipoFactura: "Ordinaria", fechaEmision: "31/3/2026", fechaPago: "30/4/2026", estado: "PAGADO", total: -120 },
  { id: "f9", tipo: "COMPRA", cliente: "Ferretería Reina", numeroFactura: "483/2026", tipoFactura: "Ordinaria", fechaEmision: "30/3/2026", fechaPago: "26/3/2026", estado: "PAGADO", total: -24 },
  { id: "f10", tipo: "COMPRA", cliente: "Sesame Labs SL", numeroFactura: "CH202603-14788", tipoFactura: "Ordinaria", fechaEmision: "30/3/2026", fechaPago: "29/4/2026", estado: "PAGADO", total: -220.22 },
  { id: "f11", tipo: "VENTA", cliente: "Cliente VIP Mesa 4", numeroFactura: "V-2026-001", tipoFactura: "Ordinaria", fechaEmision: "5/4/2026", fechaPago: "5/4/2026", estado: "COBRADO", total: 450 },
  { id: "f12", tipo: "VENTA", cliente: "Evento corporativo", numeroFactura: "V-2026-002", tipoFactura: "Ordinaria", fechaEmision: "2/4/2026", fechaPago: "", estado: "PENDIENTE", total: 1800 },
];

export const SAMPLE_TRANSACCIONES: TransaccionContable[] = [
  { id: "t1", concepto: "ANGIE CAROLINA DÍAZ MORA", banco: "Revolut", fecha: "7/4/2026", importe: -70.66, tipo: "PAGO", etiquetas: [{ categoria: "Personal > Nóminas", detalle: "Angie Carolina", color: "bg-blue-100 text-blue-700" }, { categoria: "Área Operativa > Camarero", detalle: "", color: "bg-emerald-100 text-emerald-700" }], documentos: 1, conciliada: true },
  { id: "t2", concepto: "Comisión transferencia", banco: "Revolut", fecha: "7/4/2026", importe: -0.20, tipo: "PAGO", etiquetas: [{ categoria: "Generales > Bancos", detalle: "", color: "bg-emerald-100 text-emerald-700" }], documentos: 0, conciliada: false },
  { id: "t3", concepto: "JORGE BELDA GARRIGOS", banco: "Revolut", fecha: "7/4/2026", importe: -275.82, tipo: "PAGO", etiquetas: [{ categoria: "Personal > Nóminas", detalle: "Jorge Belda", color: "bg-blue-100 text-blue-700" }, { categoria: "Área Operativa > Artistas", detalle: "", color: "bg-emerald-100 text-emerald-700" }], documentos: 1, conciliada: true },
  { id: "t4", concepto: "RUTH GONZÁLEZ LORENZO", banco: "Revolut", fecha: "7/4/2026", importe: -275.82, tipo: "PAGO", etiquetas: [{ categoria: "Personal > Nóminas", detalle: "Ruth", color: "bg-blue-100 text-blue-700" }, { categoria: "Área Operativa > Artistas", detalle: "", color: "bg-emerald-100 text-emerald-700" }], documentos: 1, conciliada: false },
  { id: "t5", concepto: "CINTHYA PÉREZ CARMONA", banco: "Revolut", fecha: "7/4/2026", importe: -669.80, tipo: "PAGO", etiquetas: [{ categoria: "Personal > Nóminas", detalle: "Cinthia Pérez", color: "bg-blue-100 text-blue-700" }, { categoria: "Área Operativa > Limpieza", detalle: "", color: "bg-violet-100 text-violet-700" }], documentos: 1, conciliada: true },
  { id: "t6", concepto: "AGORA TARJETA", banco: "Revolut", fecha: "7/4/2026", importe: 986.03, tipo: "COBRO", etiquetas: [], documentos: 0, conciliada: false },
  { id: "t7", concepto: "AGORA TARJETA", banco: "Revolut", fecha: "7/4/2026", importe: 2595.80, tipo: "COBRO", etiquetas: [], documentos: 0, conciliada: false },
  { id: "t8", concepto: "FACEBOOK", banco: "Revolut", fecha: "7/4/2026", importe: -200, tipo: "PAGO", etiquetas: [], documentos: 0, conciliada: false },
  { id: "t9", concepto: "COCACOLA", banco: "Revolut", fecha: "7/4/2026", importe: -120.23, tipo: "PAGO", etiquetas: [], documentos: 0, conciliada: false },
  { id: "t10", concepto: "Lovable", banco: "Revolut", fecha: "6/4/2026", importe: -50, tipo: "PAGO", etiquetas: [], documentos: 0, conciliada: false },
];

export const SAMPLE_CONCILIACION: ConciliacionItem[] = [
  { id: "co1", transaccion: "FACEBOOK", banco: "Revolut", fecha: "7/4/2026", importe: -200, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co2", transaccion: "AGORA TARJETA", banco: "Revolut", fecha: "7/4/2026", importe: 986.03, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co3", transaccion: "AGORA TARJETA", banco: "Revolut", fecha: "7/4/2026", importe: 2595.80, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co4", transaccion: "AGORA TARJETA", banco: "Revolut", fecha: "7/4/2026", importe: 165, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co5", transaccion: "COCACOLA", banco: "Revolut", fecha: "7/4/2026", importe: -120.23, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co6", transaccion: "Lovable", banco: "Revolut", fecha: "6/4/2026", importe: -50, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co7", transaccion: "Comisión transferencia", banco: "Revolut", fecha: "6/4/2026", importe: -0.20, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co8", transaccion: "Lovable", banco: "Revolut", fecha: "6/4/2026", importe: -25, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co9", transaccion: "FACEBOOK", banco: "Revolut", fecha: "4/4/2026", importe: -190.48, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
  { id: "co10", transaccion: "DITHER", banco: "Revolut", fecha: "2/4/2026", importe: -244.48, facturaAsociada: "", emision: "", totalIva: "", conciliada: false },
];

export const SAMPLE_BANCOS: BancoConectado[] = [
  { id: "b1", nombre: "Efectivo", productos: 1, sincronizacion: "MANUAL", ultimaSync: "7/4/2026 a las 13:30", color: "bg-amber-500" },
  { id: "b2", nombre: "Revolut", productos: 3, sincronizacion: "AUTOMATICA", ultimaSync: "7/4/2026 a las 14:24", color: "bg-violet-600" },
  { id: "b3", nombre: "BBVA", productos: 1, sincronizacion: "AUTOMATICA", ultimaSync: "7/4/2026 a las 14:20", color: "bg-blue-700" },
  { id: "b4", nombre: "Fondo de Cajas", productos: 1, sincronizacion: "MANUAL", ultimaSync: "2/1/2025 a las 14:18", color: "bg-amber-600" },
  { id: "b5", nombre: "Informes", productos: 4, sincronizacion: "MANUAL", ultimaSync: "18/3/2026 a las 18:21", color: "bg-emerald-600" },
  { id: "b6", nombre: "Liquidez", productos: 1, sincronizacion: "MANUAL", ultimaSync: "27/3/2026 a las 14:51", color: "bg-teal-600" },
];

/* ── Impuestos data ── */
export interface FilaImpuesto {
  concepto: string;
  t1: number; t2: number; t3: number; t4: number;
  expandible?: boolean;
}

export const IMPUESTOS_INGRESOS: FilaImpuesto[] = [
  { concepto: "Base imponible", t1: 0, t2: 0, t3: 0, t4: 0 },
  { concepto: "Suplidos", t1: 0, t2: 0, t3: 0, t4: 0 },
  { concepto: "Impuestos sin asignar", t1: 0, t2: 0, t3: 0, t4: 0 },
];

export const IMPUESTOS_GASTOS: FilaImpuesto[] = [
  { concepto: "Base imponible", t1: 59000.38, t2: 3893.84, t3: 0, t4: 0 },
  { concepto: "Suplidos", t1: 0, t2: 0, t3: 0, t4: 0 },
  { concepto: "IVA", t1: 8027.41, t2: 776.20, t3: 0, t4: 0, expandible: true },
  { concepto: "Impuestos sin asignar", t1: 0, t2: 0, t3: 0, t4: 0 },
];

/* ── Escenarios data ── */
export interface EscenarioMes {
  mes: string;
  entradas: number;
  salidas: number;
  saldo: number;
  actual?: boolean;
}

export const SAMPLE_ESCENARIO: EscenarioMes[] = [
  { mes: "Ene 2026", entradas: 51078, salidas: 48682, saldo: 16845 },
  { mes: "Feb 2026", entradas: 99974, salidas: 49385, saldo: 67457 },
  { mes: "Mar 2026", entradas: 59192, salidas: 42089, saldo: 84560 },
  { mes: "Abr 2026", entradas: 6049, salidas: 4506, saldo: 86103, actual: true },
  { mes: "May 2026", entradas: 77209, salidas: 41709, saldo: 121603 },
  { mes: "Jun 2026", entradas: 72409, salidas: 40175, saldo: 153837 },
  { mes: "Jul 2026", entradas: 73897, salidas: 39629, saldo: 188105 },
  { mes: "Ago 2026", entradas: 73282, salidas: 39884, saldo: 221503 },
  { mes: "Sep 2026", entradas: 74837, salidas: 41136, saldo: 255204 },
  { mes: "Oct 2026", entradas: 74000, salidas: 41000, saldo: 288204 },
];

/* Filtros laterales contables */
export const FILTROS_CONTABLES = [
  "Categorías", "Alerta", "Ingreso", "Departamentos", "Empleados", "Informes", "Estadísticas", "Patrimonio",
];

/* ── Etiquetas ── */
export interface EtiquetaContable {
  id: string;
  nombre: string;
  categoria: string;
  color: string;
  badgeClass: string;
  usos: number;
}

export const CATEGORIAS_ETIQUETA = ["Personal", "General", "Operativa", "Marketing", "Fiscal", "Proveedores"];

export const SAMPLE_ETIQUETAS: EtiquetaContable[] = [
  { id: "et1", nombre: "Nóminas", categoria: "Personal", color: "bg-blue-500", badgeClass: "bg-blue-100 text-blue-700 border-blue-300", usos: 14 },
  { id: "et2", nombre: "Camarero", categoria: "Personal", color: "bg-blue-400", badgeClass: "bg-blue-100 text-blue-700 border-blue-300", usos: 6 },
  { id: "et3", nombre: "Limpieza", categoria: "Personal", color: "bg-violet-500", badgeClass: "bg-violet-100 text-violet-700 border-violet-300", usos: 3 },
  { id: "et4", nombre: "Artistas", categoria: "Personal", color: "bg-pink-500", badgeClass: "bg-pink-100 text-pink-700 border-pink-300", usos: 4 },
  { id: "et5", nombre: "Bancos", categoria: "General", color: "bg-emerald-500", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-300", usos: 8 },
  { id: "et6", nombre: "Seguros", categoria: "General", color: "bg-teal-500", badgeClass: "bg-teal-100 text-teal-700 border-teal-300", usos: 2 },
  { id: "et7", nombre: "AGORA", categoria: "Operativa", color: "bg-amber-500", badgeClass: "bg-amber-100 text-amber-700 border-amber-300", usos: 5 },
  { id: "et8", nombre: "IICTPV", categoria: "Operativa", color: "bg-amber-400", badgeClass: "bg-amber-100 text-amber-700 border-amber-300", usos: 3 },
  { id: "et9", nombre: "INTERESES TARJETA", categoria: "Fiscal", color: "bg-red-500", badgeClass: "bg-red-100 text-red-700 border-red-300", usos: 2 },
  { id: "et10", nombre: "PALGRAPHIC", categoria: "Proveedores", color: "bg-orange-500", badgeClass: "bg-orange-100 text-orange-700 border-orange-300", usos: 3 },
  { id: "et11", nombre: "AMAZON", categoria: "Proveedores", color: "bg-orange-400", badgeClass: "bg-orange-100 text-orange-700 border-orange-300", usos: 7 },
  { id: "et12", nombre: "Facebook Ads", categoria: "Marketing", color: "bg-indigo-500", badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-300", usos: 4 },
];

/* ── Reglas automáticas ── */
export type PrioridadRegla = "ALTA" | "MEDIA" | "BAJA";

export interface ReglaAutomatica {
  id: string;
  nombre: string;
  condicionTexto: string;
  accionTexto: string;
  prioridad: PrioridadRegla;
  activa: boolean;
}

export const SAMPLE_REGLAS: ReglaAutomatica[] = [
  { id: "r1", nombre: "Etiquetar pagos Amazon", condicionTexto: "concepto contiene \"AMAZON\"", accionTexto: "Asignar etiqueta → AMAZON", prioridad: "ALTA", activa: true },
  { id: "r2", nombre: "Nóminas por transferencia", condicionTexto: "banco = Revolut + importe < 0 + concepto contiene nombre empleado", accionTexto: "Asignar etiqueta → Nóminas", prioridad: "ALTA", activa: true },
  { id: "r3", nombre: "Comisiones bancarias", condicionTexto: "concepto contiene \"Comisión\"", accionTexto: "Asignar etiqueta → Bancos", prioridad: "MEDIA", activa: true },
  { id: "r4", nombre: "Facebook Ads", condicionTexto: "concepto contiene \"FACEBOOK\"", accionTexto: "Asignar etiqueta → Facebook Ads", prioridad: "MEDIA", activa: true },
  { id: "r5", nombre: "Cobros TPV Agora", condicionTexto: "concepto contiene \"AGORA\" + importe > 0", accionTexto: "Asignar etiqueta → AGORA + categoría → Ventas TPV", prioridad: "MEDIA", activa: true },
  { id: "r6", nombre: "Gastos limpieza", condicionTexto: "contacto = Servicio limpieza", accionTexto: "Asignar etiqueta → Limpieza", prioridad: "BAJA", activa: false },
];
