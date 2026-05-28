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

export interface IngredienteElaboracion {
  id?: string;
  productoId: string | null;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  orden: number;
  // Alérgenos hidratados desde el producto de compra vinculado (vía JOIN).
  // Vacío si el ingrediente no está vinculado a un producto registrado.
  alergenos?: string[];
}

export interface ProductoVentaVinculado {
  productoId: string;
  nombre: string;
  categoria?: string | null;
  unidad?: string | null;
}

export interface Elaboracion {
  id: string;
  nombre: string;
  productoElaboracionId: string; // legacy, links to ProductoElaboracion (puede quedar vacío)
  categoria: string;
  fecha: string;
  cantidadProducida: number;
  unidad: string;
  componentes: ComponenteElaboracion[]; // legacy (no persistido)
  ingredientes?: IngredienteElaboracion[]; // productos de compra
  productosVenta?: ProductoVentaVinculado[]; // productos venta vinculados
  productosVentaLegacy?: string[]; // nombres de productos venta sin match
  alergenos: string[];
  raciones?: number | null;
  instrucciones?: string;
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

// ─── Accessors ────────────────────────────────────────────
// Datos reales vendrán de Supabase en próxima iteración.
// Vacío hasta que se migren las elaboraciones reales desde la antigua plataforma.

export function getProductosElaboracion(_empresaId: string): ProductoElaboracion[] {
  return [];
}

export function getElaboraciones(_empresaId: string): Elaboracion[] {
  return [];
}

export function calcularCosteElaboracion(componentes: ComponenteElaboracion[]): number {
  return componentes.reduce((sum, c) => sum + c.cantidad * c.costeUnitario, 0);
}
