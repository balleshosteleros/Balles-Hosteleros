export type TipoProducto = "compra" | "venta" | "elaboracion";

export type EstadoProducto = "Activo" | "Inactivo" | "En revisión";

export const IVA_OPCIONES = ["0%", "4%", "10%", "21%"] as const;
export type IvaOpcion = typeof IVA_OPCIONES[number];

export interface Producto {
  id: string;
  nombre: string;
  tipo: TipoProducto;
  categoria: string;
  familia: string;
  estado: EstadoProducto;
  proveedor?: string;
  precioCompra?: string;
  precioVenta?: string;
  coste?: string;
  iva?: string;
  unidad: string;
  ultimaActualizacion: string;
  observaciones?: string;
}

// ─── Categorías y familias ───

export const CATEGORIAS_COMPRA = [
  "Materias primas", "Bebidas", "Limpieza", "Utensilios", "Consumibles", "Ingredientes",
];

export const FAMILIAS_COMPRA = [
  "Cárnicos", "Pescados", "Lácteos", "Verduras y frutas", "Bebidas alcohólicas",
  "Bebidas sin alcohol", "Higiene", "Menaje", "Otros",
];

export const CATEGORIAS_VENTA = [
  "Platos", "Bebidas", "Cócteles", "Postres", "Menús", "Extras",
];

export const FAMILIAS_VENTA = [
  "Entrantes", "Principales", "Postres", "Bebidas carta", "Cócteles carta",
  "Menú degustación", "Menú del día", "Extras",
];

export const ESTADOS_PRODUCTO: EstadoProducto[] = ["Activo", "Inactivo", "En revisión"];

export const ESTADO_COLOR: Record<EstadoProducto, string> = {
  Activo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Inactivo: "bg-muted text-muted-foreground border-muted-foreground/30",
  "En revisión": "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

// ─── Accessors ───
// Datos reales vendrán de Supabase en próxima iteración.
// Vacío hasta que se migren los productos reales desde la antigua plataforma.

export function getProductosPorEmpresa(_empresaId: string, _tipo: TipoProducto): Producto[] {
  return [];
}

export const CATEGORIAS_ELABORACION = [
  "Salsas", "Masas y panes", "Fondos y caldos", "Guarniciones", "Marinados y adobos",
  "Rellenos", "Postres base", "Otros",
];

export const FAMILIAS_ELABORACION = [
  "Preparaciones frías", "Preparaciones calientes", "Bases", "Acompañamientos", "Otros",
];

export function getCategorias(tipo: TipoProducto): string[] {
  if (tipo === "compra") return CATEGORIAS_COMPRA;
  if (tipo === "elaboracion") return CATEGORIAS_ELABORACION;
  return CATEGORIAS_VENTA;
}

export function getFamilias(tipo: TipoProducto): string[] {
  if (tipo === "compra") return FAMILIAS_COMPRA;
  if (tipo === "elaboracion") return FAMILIAS_ELABORACION;
  return FAMILIAS_VENTA;
}
