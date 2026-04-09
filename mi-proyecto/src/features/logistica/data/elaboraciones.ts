// ─── Types ────────────────────────────────────────────────

export type EstadoElaboracion = "borrador" | "en_proceso" | "confirmado" | "archivado";

export interface ComponenteElaboracion {
  productoId: string;
  nombre: string;
  tipo: "compra" | "elaboracion";
  cantidad: number;
  unidad: string;
  costeUnitario: number; // €
}

export interface Elaboracion {
  id: string;
  nombre: string;
  productoElaboracionId: string; // links to ProductoElaboracion
  fecha: string;
  cantidadProducida: number;
  unidad: string;
  componentes: ComponenteElaboracion[];
  estado: EstadoElaboracion;
  creador: string;
  almacen: "COCINA" | "BARRA";
  observaciones: string;
  empresaId: string;
}

// ─── Producto tipo elaboración (tercera clasificación) ────

export interface ProductoElaboracion {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stockActual: number;
  costeEstimado: number; // € per unit
  estado: "Activo" | "Inactivo";
  empresaId: string;
}

export const CATEGORIAS_ELABORACION = [
  "Salsas", "Fondos", "Cremas", "Guarniciones", "Bases", "Mise en place", "Reducciones", "Preparados", "Otros",
];

export const ESTADO_ELABORACION_COLOR: Record<EstadoElaboracion, string> = {
  borrador: "bg-muted text-muted-foreground border-muted-foreground/30",
  en_proceso: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  confirmado: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  archivado: "bg-muted text-muted-foreground border-muted-foreground/20",
};

export const ESTADO_ELABORACION_LABEL: Record<EstadoElaboracion, string> = {
  borrador: "Borrador",
  en_proceso: "En proceso",
  confirmado: "Confirmado",
  archivado: "Archivado",
};

// ─── Mock data ────────────────────────────────────────────

const productosElabHabana: ProductoElaboracion[] = [
  { id: "pe-h1", nombre: "Salsa chimichurri", categoria: "Salsas", unidad: "L", stockActual: 5, costeEstimado: 4.20, estado: "Activo", empresaId: "habana" },
  { id: "pe-h2", nombre: "Fondo de pescado", categoria: "Fondos", unidad: "L", stockActual: 8, costeEstimado: 3.50, estado: "Activo", empresaId: "habana" },
  { id: "pe-h3", nombre: "Crema de queso", categoria: "Cremas", unidad: "kg", stockActual: 3, costeEstimado: 6.00, estado: "Activo", empresaId: "habana" },
  { id: "pe-h4", nombre: "Guarnición tropical", categoria: "Guarniciones", unidad: "kg", stockActual: 2, costeEstimado: 5.80, estado: "Activo", empresaId: "habana" },
  { id: "pe-h5", nombre: "Reducción de ron", categoria: "Reducciones", unidad: "L", stockActual: 1.5, costeEstimado: 8.00, estado: "Activo", empresaId: "habana" },
];

const productosElabBacanal: ProductoElaboracion[] = [
  { id: "pe-b1", nombre: "Salsa de trufa", categoria: "Salsas", unidad: "L", stockActual: 2, costeEstimado: 25.00, estado: "Activo", empresaId: "bacanal" },
  { id: "pe-b2", nombre: "Fondo oscuro de ternera", categoria: "Fondos", unidad: "L", stockActual: 10, costeEstimado: 5.00, estado: "Activo", empresaId: "bacanal" },
  { id: "pe-b3", nombre: "Crema de foie", categoria: "Cremas", unidad: "kg", stockActual: 1.5, costeEstimado: 18.00, estado: "Activo", empresaId: "bacanal" },
  { id: "pe-b4", nombre: "Mise en place wagyu", categoria: "Mise en place", unidad: "kg", stockActual: 3, costeEstimado: 15.00, estado: "Activo", empresaId: "bacanal" },
];

const elaboracionesHabana: Elaboracion[] = [
  {
    id: "el-h1", nombre: "Salsa chimichurri", productoElaboracionId: "pe-h1",
    fecha: "2026-04-05", cantidadProducida: 2, unidad: "L",
    componentes: [
      { productoId: "hc9", nombre: "Aceite de oliva virgen extra", tipo: "compra", cantidad: 0.5, unidad: "L", costeUnitario: 7.50 },
    ],
    estado: "confirmado", creador: "Carlos Martínez", almacen: "COCINA", observaciones: "Lote semanal", empresaId: "habana",
  },
  {
    id: "el-h2", nombre: "Fondo de pescado", productoElaboracionId: "pe-h2",
    fecha: "2026-04-06", cantidadProducida: 5, unidad: "L",
    componentes: [],
    estado: "borrador", creador: "Ana López", almacen: "COCINA", observaciones: "", empresaId: "habana",
  },
];

const elaboracionesBacanal: Elaboracion[] = [
  {
    id: "el-b1", nombre: "Salsa de trufa", productoElaboracionId: "pe-b1",
    fecha: "2026-04-04", cantidadProducida: 1, unidad: "L",
    componentes: [
      { productoId: "bc3", nombre: "Trufa negra", tipo: "compra", cantidad: 0.1, unidad: "kg", costeUnitario: 180.00 },
      { productoId: "pe-b2", nombre: "Fondo oscuro de ternera", tipo: "elaboracion", cantidad: 0.5, unidad: "L", costeUnitario: 5.00 },
    ],
    estado: "confirmado", creador: "Miguel Fernández", almacen: "COCINA", observaciones: "", empresaId: "bacanal",
  },
];

// ─── State holders (in-memory) ────────────────────────────

const ALL_PRODUCTOS_ELAB: Record<string, ProductoElaboracion[]> = {
  habana: productosElabHabana,
  bacanal: productosElabBacanal,
};

const ALL_ELABORACIONES: Record<string, Elaboracion[]> = {
  habana: elaboracionesHabana,
  bacanal: elaboracionesBacanal,
};

export function getProductosElaboracion(empresaId: string): ProductoElaboracion[] {
  return structuredClone(ALL_PRODUCTOS_ELAB[empresaId] || []);
}

export function getElaboraciones(empresaId: string): Elaboracion[] {
  return structuredClone(ALL_ELABORACIONES[empresaId] || []);
}

export function calcularCosteElaboracion(componentes: ComponenteElaboracion[]): number {
  return componentes.reduce((sum, c) => sum + c.cantidad * c.costeUnitario, 0);
}
