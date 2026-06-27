export type TipoProducto = "compra" | "venta" | "elaboracion";

export type EstadoProducto = "Activo" | "Inactivo";

export const IVA_OPCIONES = ["0%", "4%", "10%", "21%"] as const;
export type IvaOpcion = typeof IVA_OPCIONES[number];

// IVA por defecto: ningún precio de compra puede quedar "sin IVA". Cuando no se
// elige uno explícito, se aplica el tipo general (21%). Orden de preferencia para
// elegir un default válido a partir del catálogo de la empresa.
export const IVA_DEFAULT: IvaOpcion = "21%";
export const IVA_PREFERENCIA: readonly string[] = ["21%", "10%", "4%", "0%"];

/** Devuelve un IVA por defecto válido a partir del catálogo disponible. */
export function pickDefaultIva(ivas: readonly string[]): string {
  for (const pref of IVA_PREFERENCIA) {
    if (ivas.includes(pref)) return pref;
  }
  return ivas[0] ?? IVA_DEFAULT;
}

export const CONSERVACION_OPCIONES = ["Ambiente", "Refrigeración", "Congelación"] as const;
export type Conservacion = typeof CONSERVACION_OPCIONES[number];

export const UNIDADES_PRODUCTO = [
  { value: "kg", label: "Kg" },
  { value: "L",  label: "L"  },
  { value: "ud", label: "Ud" },
] as const;

// 14 alérgenos oficiales del Reglamento UE 1169/2011.
// Único catálogo del proyecto — no duplicar en ningún sitio.
// Los valores se guardan literales (case-sensitive) en productos.alergenos,
// elaboraciones.alergenos y escandallos.alergenos.
export const ALERGENOS_UE_14 = [
  "Gluten",
  "Crustáceos",
  "Huevos",
  "Pescado",
  "Cacahuetes",
  "Soja",
  "Lácteos",
  "Frutos con cáscara",
  "Apio",
  "Mostaza",
  "Sésamo",
  "Sulfitos",
  "Altramuces",
  "Moluscos",
] as const;

export type AlergenoUE = typeof ALERGENOS_UE_14[number];

export interface Producto {
  id: string;
  numeroSecuencial?: number;
  nombre: string;
  tipo: TipoProducto;
  categoria: string;
  estado: EstadoProducto;
  proveedor?: string;
  precioCompra?: string;
  precioVenta?: string;
  coste?: string;
  iva?: string;
  medida: string;
  formato?: string;
  envase?: string;
  ultimaActualizacion: string;
  // Marca temporal de creación; se usa para asignar el nº correlativo estable.
  createdAt?: string;
  observaciones?: string;
  conservacion?: Conservacion | null;
  partida?: string | null;
  estiloColor?: string | null;
  estiloImagenUrl?: string | null;
  textoTicket?: string;
  textoComanda?: string;
  cartaNombre?: string | null;
  cartaTexto?: string | null;
  alergenos: string[];
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
// Se muestran solo las iniciales de la unidad: L, U, K.
export const FORMATOS_POR_UNIDAD: Record<string, string[]> = {
  kg: ["0,05 K", "0,1 K", "0,2 K", "0,5 K", "1 K", "2 K", "2,5 K", "8 K", "10 K"],
  L:  ["0,70 L", "1 L", "1,5 L", "2 L", "5 L", "50 L"],
  ud: Array.from({ length: 100 }, (_, i) => `${i + 1} U`),
};

export function getFormatosPorUnidad(unidad: string): string[] {
  return FORMATOS_POR_UNIDAD[unidad] ?? [];
}

export function getUnidadDeFormato(formato: string): string | null {
  if (!formato) return null;
  for (const [u, formatos] of Object.entries(FORMATOS_POR_UNIDAD)) {
    if (formatos.includes(formato)) return u;
  }
  return null;
}

// ─── Categorías ───

export const CATEGORIAS_COMPRA = [
  "Materias primas", "Bebidas", "Limpieza", "Utensilios", "Consumibles", "Ingredientes",
];

export const CATEGORIAS_VENTA = [
  "Platos", "Bebidas", "Cócteles", "Postres", "Menús", "Extras",
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

export function getCategorias(tipo: TipoProducto): string[] {
  if (tipo === "compra") return CATEGORIAS_COMPRA;
  if (tipo === "elaboracion") return CATEGORIAS_ELABORACION;
  return CATEGORIAS_VENTA;
}
