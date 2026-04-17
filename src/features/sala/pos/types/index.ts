/**
 * Tipos del submódulo POS (Punto de Venta).
 * Espejo en camelCase de las tablas `pos_*` de la migración 035_pos.sql.
 */

export type TicketEstado = "ABIERTO" | "ENVIADO" | "COBRADO" | "ANULADO";
export type PagoMedio = "EFECTIVO" | "TARJETA" | "BIZUM" | "VALE" | "OTROS";
export type CajaEstado = "ABIERTA" | "CERRADA";
export type LineaDestino = "COCINA" | "BARRA" | "NINGUNO";
export type MovimientoCajaTipo = "APORTE" | "RETIRADA";

// ─── Sesión de caja (arqueo) ──────────────────────────────────
export interface SesionCaja {
  id: string;
  empresaId: string;
  empleadoId: string | null;
  abiertaAt: string;
  cerradaAt: string | null;
  fondoInicial: number;
  teoricoCierre: number | null;
  realCierre: number | null;
  diferencia: number | null;
  estado: CajaEstado;
  notas: string;
  createdAt: string;
}

// ─── Ticket ──────────────────────────────────────────────────
export interface Ticket {
  id: string;
  empresaId: string;
  sesionCajaId: string | null;
  numero: string;
  mesaId: string | null;
  comensales: number;
  empleadoId: string | null;
  estado: TicketEstado;
  subtotal: number;
  descuentoId: string | null;
  descuentoValor: number;
  ivaTotal: number;
  total: number;
  abiertoAt: string;
  enviadoAt: string | null;
  cerradoAt: string | null;
  anuladoAt: string | null;
  anuladoMotivo: string | null;
  stockDescontado: boolean;
  notas: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Línea de ticket ─────────────────────────────────────────
export interface TicketLinea {
  id: string;
  ticketId: string;
  productoId: string | null;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  ivaPct: number;
  descuentoPct: number;
  destino: LineaDestino;
  enviadaAt: string | null;
  notaCocina: string;
  comensalIdx: number | null;
  createdAt: string;
}

// ─── Pago ────────────────────────────────────────────────────
export interface Pago {
  id: string;
  ticketId: string;
  medio: PagoMedio;
  importe: number;
  referencia: string | null;
  creadoAt: string;
}

// ─── Movimiento de caja ──────────────────────────────────────
export interface MovimientoCaja {
  id: string;
  sesionCajaId: string;
  tipo: MovimientoCajaTipo;
  importe: number;
  motivo: string;
  creadoAt: string;
}

// ─── Agregados / UI ──────────────────────────────────────────
export interface TicketConLineas extends Ticket {
  lineas: TicketLinea[];
  pagos?: Pago[];
}

export interface TotalesTicket {
  subtotal: number;
  descuento: number;
  baseImponible: number;
  iva: number;
  total: number;
  /** IVA desglosado por tipo (p. ej. { "10": 12.3, "21": 4.5 }) */
  ivaDesglosado: Record<string, number>;
}

export interface SubTicket {
  id: string;
  label: string;
  lineas: TicketLinea[];
  totales: TotalesTicket;
}

// ─── Productos (vista POS, alias sobre Producto de Logística) ─
export interface ProductoPOS {
  id: string;
  nombre: string;
  categoria: string;
  familia: string | null;
  precioVenta: number;
  ivaPct: number;
  imagenUrl: string | null;
  destino: LineaDestino;
}
