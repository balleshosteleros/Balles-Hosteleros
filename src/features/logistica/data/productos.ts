export type TipoProducto = "compra" | "venta";

export type EstadoProducto = "Activo" | "Inactivo" | "Descatalogado" | "En revisión";

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

export const ESTADOS_PRODUCTO: EstadoProducto[] = ["Activo", "Inactivo", "Descatalogado", "En revisión"];

export const ESTADO_COLOR: Record<EstadoProducto, string> = {
  Activo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Inactivo: "bg-muted text-muted-foreground border-muted-foreground/30",
  Descatalogado: "bg-destructive/10 text-destructive border-destructive/30",
  "En revisión": "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

// ─── Mock data ───

const HABANA_COMPRA: Producto[] = [
  { id: "hc1", nombre: "Solomillo de ternera", tipo: "compra", categoria: "Materias primas", familia: "Cárnicos", estado: "Activo", proveedor: "Carnes del Norte", precioCompra: "18,50 €/kg", unidad: "kg", ultimaActualizacion: "2026-04-05" },
  { id: "hc2", nombre: "Langostinos tigre", tipo: "compra", categoria: "Materias primas", familia: "Pescados", estado: "Activo", proveedor: "Mariscos Galicia", precioCompra: "22,00 €/kg", unidad: "kg", ultimaActualizacion: "2026-04-03" },
  { id: "hc3", nombre: "Vodka premium", tipo: "compra", categoria: "Bebidas", familia: "Bebidas alcohólicas", estado: "Activo", proveedor: "Distribuciones Licor", precioCompra: "14,80 €/ud", unidad: "ud", ultimaActualizacion: "2026-03-28" },
  { id: "hc4", nombre: "Ron añejo reserva", tipo: "compra", categoria: "Bebidas", familia: "Bebidas alcohólicas", estado: "Activo", proveedor: "Distribuciones Licor", precioCompra: "19,50 €/ud", unidad: "ud", ultimaActualizacion: "2026-04-01" },
  { id: "hc5", nombre: "Zumo de naranja natural", tipo: "compra", categoria: "Bebidas", familia: "Bebidas sin alcohol", estado: "Activo", proveedor: "Zumos del Sur", precioCompra: "3,20 €/L", unidad: "L", ultimaActualizacion: "2026-04-04" },
  { id: "hc6", nombre: "Detergente industrial", tipo: "compra", categoria: "Limpieza", familia: "Higiene", estado: "Activo", proveedor: "Limpiezas Pro", precioCompra: "8,90 €/ud", unidad: "ud", ultimaActualizacion: "2026-03-15" },
  { id: "hc7", nombre: "Vasos cristal cocktail", tipo: "compra", categoria: "Utensilios", familia: "Menaje", estado: "Activo", proveedor: "Hostelería Total", precioCompra: "2,40 €/ud", unidad: "ud", ultimaActualizacion: "2026-03-20" },
  { id: "hc8", nombre: "Servilletas premium", tipo: "compra", categoria: "Consumibles", familia: "Otros", estado: "Inactivo", proveedor: "Papelera Central", precioCompra: "0,03 €/ud", unidad: "ud", ultimaActualizacion: "2026-02-10" },
  { id: "hc9", nombre: "Aceite de oliva virgen extra", tipo: "compra", categoria: "Ingredientes", familia: "Verduras y frutas", estado: "Activo", proveedor: "Aceites Jaén", precioCompra: "7,50 €/L", unidad: "L", ultimaActualizacion: "2026-04-02" },
  { id: "hc10", nombre: "Queso manchego curado", tipo: "compra", categoria: "Materias primas", familia: "Lácteos", estado: "En revisión", proveedor: "Lácteos La Mancha", precioCompra: "12,00 €/kg", unidad: "kg", ultimaActualizacion: "2026-04-06" },
];

const HABANA_VENTA: Producto[] = [
  { id: "hv1", nombre: "Tataki de atún rojo", tipo: "venta", categoria: "Platos", familia: "Entrantes", estado: "Activo", precioVenta: "18,00 €", coste: "6,20 €", unidad: "ración", ultimaActualizacion: "2026-04-05" },
  { id: "hv2", nombre: "Solomillo a la brasa", tipo: "venta", categoria: "Platos", familia: "Principales", estado: "Activo", precioVenta: "24,00 €", coste: "8,50 €", unidad: "ración", ultimaActualizacion: "2026-04-04" },
  { id: "hv3", nombre: "Mojito clásico", tipo: "venta", categoria: "Cócteles", familia: "Cócteles carta", estado: "Activo", precioVenta: "12,00 €", coste: "3,10 €", unidad: "ud", ultimaActualizacion: "2026-04-06" },
  { id: "hv4", nombre: "Daiquiri de fresa", tipo: "venta", categoria: "Cócteles", familia: "Cócteles carta", estado: "Activo", precioVenta: "13,00 €", coste: "3,50 €", unidad: "ud", ultimaActualizacion: "2026-04-06" },
  { id: "hv5", nombre: "Gin Tonic premium", tipo: "venta", categoria: "Bebidas", familia: "Bebidas carta", estado: "Activo", precioVenta: "14,00 €", coste: "4,20 €", unidad: "ud", ultimaActualizacion: "2026-04-03" },
  { id: "hv6", nombre: "Tarta de queso", tipo: "venta", categoria: "Postres", familia: "Postres", estado: "Activo", precioVenta: "8,00 €", coste: "2,10 €", unidad: "ración", ultimaActualizacion: "2026-04-01" },
  { id: "hv7", nombre: "Menú degustación Habana", tipo: "venta", categoria: "Menús", familia: "Menú degustación", estado: "Activo", precioVenta: "55,00 €", coste: "18,00 €", unidad: "menú", ultimaActualizacion: "2026-03-25" },
  { id: "hv8", nombre: "Tabla de ibéricos", tipo: "venta", categoria: "Platos", familia: "Entrantes", estado: "En revisión", precioVenta: "22,00 €", coste: "9,80 €", unidad: "ración", ultimaActualizacion: "2026-04-06" },
  { id: "hv9", nombre: "Cachimba premium", tipo: "venta", categoria: "Extras", familia: "Extras", estado: "Activo", precioVenta: "35,00 €", coste: "8,00 €", unidad: "servicio", ultimaActualizacion: "2026-04-05" },
];

const BACANAL_COMPRA: Producto[] = [
  { id: "bc1", nombre: "Entrecot de vaca madurada", tipo: "compra", categoria: "Materias primas", familia: "Cárnicos", estado: "Activo", proveedor: "Premium Meats", precioCompra: "25,00 €/kg", unidad: "kg", ultimaActualizacion: "2026-04-04" },
  { id: "bc2", nombre: "Champagne Moët", tipo: "compra", categoria: "Bebidas", familia: "Bebidas alcohólicas", estado: "Activo", proveedor: "Licores Selectos", precioCompra: "32,00 €/ud", unidad: "ud", ultimaActualizacion: "2026-04-02" },
  { id: "bc3", nombre: "Trufa negra", tipo: "compra", categoria: "Ingredientes", familia: "Verduras y frutas", estado: "Activo", proveedor: "Delicias Gourmet", precioCompra: "180,00 €/kg", unidad: "kg", ultimaActualizacion: "2026-04-01" },
  { id: "bc4", nombre: "Whisky japonés Hibiki", tipo: "compra", categoria: "Bebidas", familia: "Bebidas alcohólicas", estado: "Activo", proveedor: "Licores Selectos", precioCompra: "65,00 €/ud", unidad: "ud", ultimaActualizacion: "2026-03-30" },
  { id: "bc5", nombre: "Caviar beluga", tipo: "compra", categoria: "Materias primas", familia: "Pescados", estado: "En revisión", proveedor: "Delicias Gourmet", precioCompra: "320,00 €/100g", unidad: "100g", ultimaActualizacion: "2026-04-06" },
  { id: "bc6", nombre: "Gel desinfectante", tipo: "compra", categoria: "Limpieza", familia: "Higiene", estado: "Activo", proveedor: "Limpiezas Pro", precioCompra: "4,50 €/ud", unidad: "ud", ultimaActualizacion: "2026-03-18" },
];

const BACANAL_VENTA: Producto[] = [
  { id: "bv1", nombre: "Steak tartar de wagyu", tipo: "venta", categoria: "Platos", familia: "Entrantes", estado: "Activo", precioVenta: "32,00 €", coste: "14,00 €", unidad: "ración", ultimaActualizacion: "2026-04-05" },
  { id: "bv2", nombre: "Entrecot madurado 45 días", tipo: "venta", categoria: "Platos", familia: "Principales", estado: "Activo", precioVenta: "38,00 €", coste: "12,50 €", unidad: "ración", ultimaActualizacion: "2026-04-04" },
  { id: "bv3", nombre: "Old Fashioned", tipo: "venta", categoria: "Cócteles", familia: "Cócteles carta", estado: "Activo", precioVenta: "16,00 €", coste: "4,80 €", unidad: "ud", ultimaActualizacion: "2026-04-06" },
  { id: "bv4", nombre: "Espresso martini", tipo: "venta", categoria: "Cócteles", familia: "Cócteles carta", estado: "Activo", precioVenta: "15,00 €", coste: "4,00 €", unidad: "ud", ultimaActualizacion: "2026-04-05" },
  { id: "bv5", nombre: "Menú Bacanal Experience", tipo: "venta", categoria: "Menús", familia: "Menú degustación", estado: "Activo", precioVenta: "85,00 €", coste: "28,00 €", unidad: "menú", ultimaActualizacion: "2026-03-20" },
  { id: "bv6", nombre: "Coulant de chocolate", tipo: "venta", categoria: "Postres", familia: "Postres", estado: "Activo", precioVenta: "10,00 €", coste: "2,80 €", unidad: "ración", ultimaActualizacion: "2026-04-03" },
  { id: "bv7", nombre: "Botella champagne servicio", tipo: "venta", categoria: "Bebidas", familia: "Bebidas carta", estado: "Activo", precioVenta: "120,00 €", coste: "32,00 €", unidad: "ud", ultimaActualizacion: "2026-04-01" },
];

export function getProductosPorEmpresa(empresaId: string, tipo: TipoProducto): Producto[] {
  if (empresaId === "habana") return tipo === "compra" ? [...HABANA_COMPRA] : [...HABANA_VENTA];
  if (empresaId === "bacanal") return tipo === "compra" ? [...BACANAL_COMPRA] : [...BACANAL_VENTA];
  return [];
}

export function getCategorias(tipo: TipoProducto): string[] {
  return tipo === "compra" ? CATEGORIAS_COMPRA : CATEGORIAS_VENTA;
}

export function getFamilias(tipo: TipoProducto): string[] {
  return tipo === "compra" ? FAMILIAS_COMPRA : FAMILIAS_VENTA;
}
