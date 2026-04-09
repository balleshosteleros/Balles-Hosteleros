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
  numero: string;
  empresaId: string;
  empresa: string;
  proveedor: string;
  docProveedor: string;
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

// ─── Emails de proveedores (mock) ─────────────────────────
export const PROVEEDOR_EMAILS: Record<string, string> = {
  "DISTRIBUCIONES GARCÍA S.L.": "pedidos@distgarcia.es",
  "FRIGORÍFICOS DEL SUR S.A.": "compras@frigosur.es",
  "MAKRO CASH & CARRY": "proveedores@makro.es",
  "BEBIDAS PREMIUM S.L.": "pedidos@bebidaspremium.es",
  "LIMPIEZA INDUSTRIAL ROCA": "",
  "CARNES SELECTAS IBÉRICA": "pedidos@carnesiberica.es",
  "PESCADOS ATLÁNTICO S.L.": "ventas@pescadosatlantico.es",
  "FRUTAS Y VERDURAS LEVANTE": "pedidos@frutaslevante.es",
};

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

export const PROVEEDORES = [
  "DISTRIBUCIONES GARCÍA S.L.", "FRIGORÍFICOS DEL SUR S.A.", "MAKRO CASH & CARRY",
  "BEBIDAS PREMIUM S.L.", "LIMPIEZA INDUSTRIAL ROCA", "CARNES SELECTAS IBÉRICA",
  "PESCADOS ATLÁNTICO S.L.", "FRUTAS Y VERDURAS LEVANTE",
];

export const ALMACENES: Record<string, string[]> = {
  habana: ["Almacén Central Habana", "Cámara Fría Habana", "Almacén Bebidas Habana"],
  bacanal: ["Almacén Central Bacanal", "Cámara Fría Bacanal", "Almacén Bebidas Bacanal"],
};

// ─── Mock data ────────────────────────────────────────────

const lineasHabana1: LineaPedido[] = [
  { id: "lp1", productoId: "p1", producto: "Solomillo de ternera", cantidad: 20, unidad: "kg", servida: 0, precioUC: 18.50, impuesto: 10, dtoPct: 5, dtoEur: 0, total: 351.50 },
  { id: "lp2", productoId: "p2", producto: "Aceite de oliva virgen extra", cantidad: 50, unidad: "L", servida: 0, precioUC: 4.20, impuesto: 10, dtoPct: 0, dtoEur: 10, total: 200.00 },
  { id: "lp3", productoId: "p3", producto: "Langostinos congelados", cantidad: 15, unidad: "kg", servida: 0, precioUC: 22.00, impuesto: 10, dtoPct: 3, dtoEur: 0, total: 320.10 },
];

const lineasHabana2: LineaPedido[] = [
  { id: "lp4", productoId: "p4", producto: "Cerveza artesana IPA", cantidad: 100, unidad: "ud", servida: 50, precioUC: 1.80, impuesto: 21, dtoPct: 10, dtoEur: 0, total: 162.00 },
  { id: "lp5", productoId: "p5", producto: "Vino Ribera del Duero", cantidad: 24, unidad: "bot", servida: 24, precioUC: 8.50, impuesto: 21, dtoPct: 0, dtoEur: 5, total: 199.00 },
];

const lineasHabana3: LineaPedido[] = [
  { id: "lp6", productoId: "p6", producto: "Lejía industrial 5L", cantidad: 30, unidad: "ud", servida: 0, precioUC: 3.20, impuesto: 21, dtoPct: 0, dtoEur: 0, total: 96.00 },
  { id: "lp7", productoId: "p7", producto: "Jabón desengrasante", cantidad: 20, unidad: "ud", servida: 0, precioUC: 5.50, impuesto: 21, dtoPct: 5, dtoEur: 0, total: 104.50 },
];

const lineasBacanal1: LineaPedido[] = [
  { id: "lp8", productoId: "p8", producto: "Entrecot madurado", cantidad: 30, unidad: "kg", servida: 0, precioUC: 24.00, impuesto: 10, dtoPct: 0, dtoEur: 0, total: 720.00 },
  { id: "lp9", productoId: "p9", producto: "Foie mi-cuit", cantidad: 10, unidad: "kg", servida: 0, precioUC: 45.00, impuesto: 10, dtoPct: 5, dtoEur: 0, total: 427.50 },
];

const lineasBacanal2: LineaPedido[] = [
  { id: "lp10", productoId: "p10", producto: "Champagne Moët", cantidad: 12, unidad: "bot", servida: 12, precioUC: 32.00, impuesto: 21, dtoPct: 0, dtoEur: 0, total: 384.00 },
];

const pedidosHabana: Pedido[] = [
  {
    id: "ped-h1", numero: "PED-2026-001", empresaId: "habana", empresa: "La Habana Café",
    proveedor: "CARNES SELECTAS IBÉRICA", docProveedor: "OC-4521", almacen: "Almacén Central Habana",
    fecha: "2026-03-15", fechaEntrega: "2026-03-20", estado: "Borrador",
    lineas: lineasHabana1, dtoPct: 0, dtoEur: 0, notas: "Pedido semanal de cárnicos",
    albaranId: null, creador: "Carlos López", ultimaActualizacion: "2026-03-15", enviadoAt: null, enviadoEmail: null,
  },
  {
    id: "ped-h2", numero: "PED-2026-002", empresaId: "habana", empresa: "La Habana Café",
    proveedor: "BEBIDAS PREMIUM S.L.", docProveedor: "BP-1120", almacen: "Almacén Bebidas Habana",
    fecha: "2026-03-10", fechaEntrega: "2026-03-14", estado: "Confirmado",
    lineas: lineasHabana2, dtoPct: 2, dtoEur: 0, notas: "",
    albaranId: "alb-h1", creador: "María García", ultimaActualizacion: "2026-03-12", enviadoAt: "2026-03-10T09:30:00", enviadoEmail: "pedidos@bebidaspremium.es",
  },
  {
    id: "ped-h3", numero: "PED-2026-003", empresaId: "habana", empresa: "La Habana Café",
    proveedor: "LIMPIEZA INDUSTRIAL ROCA", docProveedor: "LR-0098", almacen: "Almacén Central Habana",
    fecha: "2026-03-18", fechaEntrega: "2026-03-25", estado: "Pendiente",
    lineas: lineasHabana3, dtoPct: 0, dtoEur: 0, notas: "Urgente para inspección",
    albaranId: null, creador: "Carlos López", ultimaActualizacion: "2026-03-18", enviadoAt: null, enviadoEmail: null,
  },
  {
    id: "ped-h4", numero: "PED-2026-004", empresaId: "habana", empresa: "La Habana Café",
    proveedor: "DISTRIBUCIONES GARCÍA S.L.", docProveedor: "DG-7744", almacen: "Cámara Fría Habana",
    fecha: "2026-02-28", fechaEntrega: "2026-03-05", estado: "Servido",
    lineas: [{ id: "lp11", productoId: "p11", producto: "Queso manchego curado", cantidad: 10, unidad: "kg", servida: 10, precioUC: 14.00, impuesto: 10, dtoPct: 0, dtoEur: 0, total: 140.00 }],
    dtoPct: 0, dtoEur: 0, notas: "", albaranId: "alb-h2", creador: "María García", ultimaActualizacion: "2026-03-06", enviadoAt: "2026-02-28T14:00:00", enviadoEmail: "pedidos@distgarcia.es",
  },
  {
    id: "ped-h5", numero: "PED-2026-005", empresaId: "habana", empresa: "La Habana Café",
    proveedor: "PESCADOS ATLÁNTICO S.L.", docProveedor: "PA-3390", almacen: "Cámara Fría Habana",
    fecha: "2026-01-20", fechaEntrega: "2026-01-25", estado: "Cancelado",
    lineas: [{ id: "lp12", productoId: "p12", producto: "Merluza fresca", cantidad: 25, unidad: "kg", servida: 0, precioUC: 12.50, impuesto: 10, dtoPct: 0, dtoEur: 0, total: 312.50 }],
    dtoPct: 0, dtoEur: 0, notas: "Proveedor no disponible", albaranId: null, creador: "Carlos López", ultimaActualizacion: "2026-01-22", enviadoAt: null, enviadoEmail: null,
  },
];

const pedidosBacanal: Pedido[] = [
  {
    id: "ped-b1", numero: "PED-2026-001", empresaId: "bacanal", empresa: "Bacanal Gastrobar",
    proveedor: "CARNES SELECTAS IBÉRICA", docProveedor: "OC-9012", almacen: "Almacén Central Bacanal",
    fecha: "2026-03-16", fechaEntrega: "2026-03-22", estado: "Pendiente",
    lineas: lineasBacanal1, dtoPct: 0, dtoEur: 0, notas: "Especial evento fin de semana",
    albaranId: null, creador: "Laura Martínez", ultimaActualizacion: "2026-03-16", enviadoAt: null, enviadoEmail: null,
  },
  {
    id: "ped-b2", numero: "PED-2026-002", empresaId: "bacanal", empresa: "Bacanal Gastrobar",
    proveedor: "BEBIDAS PREMIUM S.L.", docProveedor: "BP-2250", almacen: "Almacén Bebidas Bacanal",
    fecha: "2026-03-08", fechaEntrega: "2026-03-12", estado: "Confirmado",
    lineas: lineasBacanal2, dtoPct: 0, dtoEur: 0, notas: "",
    albaranId: "alb-b1", creador: "Laura Martínez", ultimaActualizacion: "2026-03-10", enviadoAt: "2026-03-08T11:15:00", enviadoEmail: "pedidos@bebidaspremium.es",
  },
];

// ─── Albaranes mock ───────────────────────────────────────

const albaranesHabana: Albaran[] = [
  {
    id: "alb-h1", numero: "ALB-2026-001", empresaId: "habana", empresa: "La Habana Café",
    proveedor: "BEBIDAS PREMIUM S.L.", documento: "ALB-BP-1120", factura: "", almacen: "Almacén Bebidas Habana",
    fecha: "2026-03-12", estado: "Confirmado",
    lineas: lineasHabana2.map((l) => ({ ...l, docPedido: "PED-2026-002" })),
    dtoPct: 2, dtoEur: 0, notas: "", pedidoId: "ped-h2", creador: "María García", ultimaActualizacion: "2026-03-12",
  },
  {
    id: "alb-h2", numero: "ALB-2026-002", empresaId: "habana", empresa: "La Habana Café",
    proveedor: "DISTRIBUCIONES GARCÍA S.L.", documento: "ALB-DG-7744", factura: "FAC-2026-011", almacen: "Cámara Fría Habana",
    fecha: "2026-03-06", estado: "Facturado",
    lineas: [{ id: "la1", productoId: "p11", producto: "Queso manchego curado", cantidad: 10, unidad: "kg", precioUC: 14.00, impuesto: 10, dtoPct: 0, dtoEur: 0, total: 140.00, docPedido: "PED-2026-004" }],
    dtoPct: 0, dtoEur: 0, notas: "", pedidoId: "ped-h4", creador: "María García", ultimaActualizacion: "2026-03-07",
  },
];

const albaranesBacanal: Albaran[] = [
  {
    id: "alb-b1", numero: "ALB-2026-001", empresaId: "bacanal", empresa: "Bacanal Gastrobar",
    proveedor: "BEBIDAS PREMIUM S.L.", documento: "ALB-BP-2250", factura: "", almacen: "Almacén Bebidas Bacanal",
    fecha: "2026-03-10", estado: "Pendiente",
    lineas: lineasBacanal2.map((l) => ({ ...l, docPedido: "PED-2026-002" })),
    dtoPct: 0, dtoEur: 0, notas: "", pedidoId: "ped-b2", creador: "Laura Martínez", ultimaActualizacion: "2026-03-10",
  },
];

// ─── Accessors ────────────────────────────────────────────

const ALL_PEDIDOS: Record<string, Pedido[]> = {
  habana: pedidosHabana,
  bacanal: pedidosBacanal,
};

const ALL_ALBARANES: Record<string, Albaran[]> = {
  habana: albaranesHabana,
  bacanal: albaranesBacanal,
};

export function getPedidosPorEmpresa(empresaId: string): Pedido[] {
  return structuredClone(ALL_PEDIDOS[empresaId] || []);
}

export function getAlbaranesPorEmpresa(empresaId: string): Albaran[] {
  return structuredClone(ALL_ALBARANES[empresaId] || []);
}
