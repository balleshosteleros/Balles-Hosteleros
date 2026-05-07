export type TipoProducto = "compra" | "venta" | "elaboracion";

export type EstadoProducto = "Activo" | "Inactivo";

export const IVA_OPCIONES = ["0%", "4%", "10%", "21%"] as const;
export type IvaOpcion = typeof IVA_OPCIONES[number];

export const CONSERVACION_OPCIONES = ["Frío", "Congelador", "Seco"] as const;
export type Conservacion = typeof CONSERVACION_OPCIONES[number];

export const PREPARACION_OPCIONES = ["Barra", "Cocina"] as const;
export type PreparacionVenta = typeof PREPARACION_OPCIONES[number];

export const PARTIDAS_POR_PREPARACION: Record<PreparacionVenta, string[]> = {
  Barra: ["Cafetería", "Coctelería", "Refrescos y cervezas", "Vinos", "Postres barra"],
  Cocina: ["FRÍO + POSTRES", "FUEGOS + HORNOS", "FREIDORA + PLANCHA", "Pase / Emplatado"],
};

export function getPartidasPorPreparacion(p: PreparacionVenta | "" | null | undefined): string[] {
  if (!p) return [];
  return PARTIDAS_POR_PREPARACION[p] ?? [];
}

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
  formato?: string;
  ultimaActualizacion: string;
  observaciones?: string;
  conservacion?: Conservacion | null;
  preparacion?: PreparacionVenta | null;
  partida?: string | null;
  estiloColor?: string | null;
  estiloImagenUrl?: string | null;
  textoTicket?: string;
  textoComanda?: string;
  cartaNombre?: string | null;
  cartaTexto?: string | null;
}

// ─── Estilo POS (solo productos de venta) ─────────────────────
export interface ColorPOS {
  nombre: string;
  hex: string;
}

export const COLORES_POS: ColorPOS[] = [
  { nombre: "Crema",     hex: "#fef9c3" },
  { nombre: "Amarillo",  hex: "#fde68a" },
  { nombre: "Naranja",   hex: "#fed7aa" },
  { nombre: "Salmón",    hex: "#fecdd3" },
  { nombre: "Rosa",      hex: "#fbcfe8" },
  { nombre: "Rojo",      hex: "#fecaca" },
  { nombre: "Lila",      hex: "#e9d5ff" },
  { nombre: "Morado",    hex: "#ddd6fe" },
  { nombre: "Azul",      hex: "#bacde2" },
  { nombre: "Cian",      hex: "#a5f3fc" },
  { nombre: "Menta",     hex: "#a7f3d0" },
  { nombre: "Verde",     hex: "#bbf7d0" },
  { nombre: "Marrón",    hex: "#e7d4c0" },
  { nombre: "Gris",      hex: "#e5e7eb" },
];

export function getColorPOSByHex(hex?: string | null): ColorPOS | null {
  if (!hex) return null;
  return COLORES_POS.find((c) => c.hex.toLowerCase() === hex.toLowerCase()) ?? null;
}

// ─── Formatos por unidad ───
// El formato disponible depende de la unidad elegida.
// Se usa en productos de compra y de elaboración.
export const FORMATOS_POR_UNIDAD: Record<string, string[]> = {
  kg:   ["Granel", "Saco 25 kg", "Caja 10 kg", "Bandeja 5 kg", "Bandeja 1 kg", "Bolsa 500 g", "Bolsa 250 g"],
  L:    ["Granel", "Garrafa 25 L", "Garrafa 5 L", "Botella 1 L", "Botella 750 ml", "Botella 500 ml", "Brick 1 L"],
  ud:   ["Suelta", "Caja 24 ud", "Caja 12 ud", "Caja 6 ud", "Pack 6 ud", "Pack 4 ud", "Bandeja"],
  bot:  ["Botella 1 L", "Botella 750 ml", "Botella 500 ml", "Botella 330 ml", "Botella 200 ml"],
  caja: ["Caja 24 ud", "Caja 12 ud", "Caja 6 ud", "Caja mixta"],
  pack: ["Pack 24 ud", "Pack 12 ud", "Pack 6 ud", "Pack 4 ud"],
};

export function getFormatosPorUnidad(unidad: string): string[] {
  return FORMATOS_POR_UNIDAD[unidad] ?? [];
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

export const ESTADOS_PRODUCTO: EstadoProducto[] = ["Activo", "Inactivo"];

export const ESTADO_COLOR: Record<EstadoProducto, string> = {
  Activo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  Inactivo: "bg-muted text-muted-foreground border-muted-foreground/30",
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
