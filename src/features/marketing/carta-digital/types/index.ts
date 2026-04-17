/**
 * Tipos del submódulo Carta Digital (PRP-028).
 * Espejo de las tablas carta_categorias, carta_items, carta_item_likes
 * y de las extensiones a la tabla empresas.
 */

export type CartaAdminData = {
  empresa: CartaEmpresaPublica | null;
  categorias: CartaCategoria[];
  items: CartaItem[];
};

export type CartaCategoria = {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
};

export type CartaItem = {
  id: string;
  empresa_id: string;
  categoria_id: string;
  producto_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  foto_url: string | null;
  foto_storage_path: string | null;
  alergenos: Alergeno[];
  orden: number;
  visible: boolean;
  destacado: boolean;
  likes_count: number;
  created_at: string;
  updated_at: string;
};

export type CartaItemLike = {
  id: string;
  item_id: string;
  device_id: string;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
};

export type CartaEmpresaPublica = {
  id: string;
  nombre: string;
  carta_slug: string;
  carta_publicada: boolean;
  carta_horarios: CartaHorarios | null;
  carta_descripcion: string | null;
  logo_url?: string | null;
};

export type CartaHorarios = {
  // Estructura libre por día. Ejemplo:
  // { lunes: ["13:00-16:00", "20:00-23:30"], martes: [...] }
  [dia: string]: string[];
};

/** Carta completa lista para render público. */
export type CartaPublica = {
  empresa: CartaEmpresaPublica;
  categorias: Array<CartaCategoria & { items: CartaItem[] }>;
  destacados: CartaItem[];
};

/** Catálogo UE 14 alérgenos. */
export const ALERGENOS_UE = [
  "gluten",
  "crustaceos",
  "huevos",
  "pescado",
  "cacahuetes",
  "soja",
  "lacteos",
  "frutos_cascara",
  "apio",
  "mostaza",
  "sesamo",
  "sulfitos",
  "altramuces",
  "moluscos",
] as const;

export type Alergeno = (typeof ALERGENOS_UE)[number];

export type EstadoCartaAdmin = "BORRADOR" | "PUBLICADA";

export type ToggleLikeResult =
  | { ok: true; liked: boolean; likesCount: number }
  | { ok: false; error: string; codigo: "RATE_LIMIT" | "NOT_FOUND" | "ERROR" };

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };
