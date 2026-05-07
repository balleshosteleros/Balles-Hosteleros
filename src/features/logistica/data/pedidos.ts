// ─── Types ────────────────────────────────────────────────

export interface LineaAnalisis {
  productoProveedor: string;
  cantidadProveedor: number;
  precioProveedor: number;
  unidadProveedor: string;
  productoInterno: string | null;
  cantidadInterna: number;
  precioInterno: number;
  tipo: "coincide" | "cantidad_diferente" | "precio_diferente" | "cantidad_y_precio" | "extra" | "faltante";
}

export interface AnalisisAlbaran {
  datosAlbaran: {
    proveedor: string;
    numero: string;
    fecha: string;
  };
  lineas: LineaAnalisis[];
  resumen: {
    totalLineas: number;
    coincidencias: number;
    diferencias: number;
    extras: number;
    faltantes: number;
    hayAlerta: boolean;
  };
}

export interface DocumentoAdjunto {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  analisis: AnalisisAlbaran | null;
  hayAlerta: boolean;
}

export type EstadoPedido = "Borrador" | "Pendiente" | "Confirmado" | "Enviado" | "Servido" | "Cancelado" | "Archivado";
export type EstadoAlbaran = "Pendiente" | "Confirmado" | "Recibido" | "Facturado" | "Archivado";

export const ESTADOS_PEDIDO: EstadoPedido[] = ["Borrador", "Pendiente", "Confirmado", "Enviado", "Servido", "Cancelado", "Archivado"];
export const ESTADOS_ALBARAN: EstadoAlbaran[] = ["Pendiente", "Confirmado", "Recibido", "Facturado", "Archivado"];

export interface LineaPedido {
  id: string;
  productoId: string;
  producto: string;
  cantidad: number;
  unidad: string;
  servida: number;
  precioUC: number;
  impuesto: number; // %
  dtoPct: number;
  dtoEur: number;
  total: number;
}

export interface Pedido {
  id: string;
  numeroSecuencial?: number;
  numero: string;
  empresaId: string;
  empresa: string;
  proveedor: string;
  almacen: string;
  fecha: string;
  fechaEntrega: string;
  estado: EstadoPedido;
  lineas: LineaPedido[];
  dtoPct: number;
  dtoEur: number;
  notas: string;
  albaranId: string | null;
  creador: string;
  ultimaActualizacion: string;
  enviadoAt: string | null;
  enviadoEmail: string | null;
}

// Emails de proveedores (se poblará con datos reales desde Supabase)
export const PROVEEDOR_EMAILS: Record<string, string> = {};

export interface LineaAlbaran {
  id: string;
  productoId: string;
  producto: string;
  cantidad: number;
  unidad: string;
  precioUC: number;
  impuesto: number;
  dtoPct: number;
  dtoEur: number;
  total: number;
  docPedido: string;
}

export interface Albaran {
  id: string;
  numeroSecuencial?: number;
  numero: string;
  empresaId: string;
  empresa: string;
  proveedor: string;
  documento: string;
  factura: string;
  almacen: string;
  fecha: string;
  estado: EstadoAlbaran;
  lineas: LineaAlbaran[];
  dtoPct: number;
  dtoEur: number;
  notas: string;
  pedidoId: string;
  creador: string;
  ultimaActualizacion: string;
}

// ─── Helpers ──────────────────────────────────────────────

export function calcularTotalesLineas(lineas: { precioUC: number; cantidad: number; impuesto: number; dtoPct: number; dtoEur: number }[]) {
  let base = 0;
  let cuota = 0;
  lineas.forEach((l) => {
    const bruto = l.precioUC * l.cantidad;
    const descuento = bruto * (l.dtoPct / 100) + l.dtoEur;
    const lineaBase = bruto - descuento;
    base += lineaBase;
    cuota += lineaBase * (l.impuesto / 100);
  });
  return { base: Math.round(base * 100) / 100, cuota: Math.round(cuota * 100) / 100, total: Math.round((base + cuota) * 100) / 100 };
}

export function calcLineaTotal(l: { precioUC: number; cantidad: number; dtoPct: number; dtoEur: number }): number {
  const bruto = l.precioUC * l.cantidad;
  return Math.round((bruto - bruto * (l.dtoPct / 100) - l.dtoEur) * 100) / 100;
}

// ─── Proveedores / Almacenes ──────────────────────────────
// Se poblarán con datos reales cuando se migren desde la antigua plataforma.

export const PROVEEDORES: string[] = [];

export const ALMACENES: Record<string, string[]> = {};

// ─── Accessors ────────────────────────────────────────────
// Datos reales vendrán de Supabase en próxima iteración.
// Vacío hasta que se migren los pedidos y albaranes reales.

export function getPedidosPorEmpresa(_empresaId: string): Pedido[] {
  return [];
}

export function getAlbaranesPorEmpresa(_empresaId: string): Albaran[] {
  return [];
}
