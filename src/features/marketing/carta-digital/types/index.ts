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

export type EstiloCards = "plana" | "sombra" | "borde";
export type ModoCarta = "claro" | "oscuro" | "auto";

export type CartaEmpresaPublica = {
  id: string;
  slug?: string;
  nombre: string;
  carta_slug: string;
  carta_publicada: boolean;
  carta_descripcion: string | null;
  logo_url?: string | null;
  logo_alt_url?: string | null;
  color_primario?: string | null;
  color_secundario?: string | null;
  color_texto?: string | null;
  carta_color_fondo?: string | null;
  carta_color_acento?: string | null;
  carta_fuente_titulos?: string | null;
  carta_fuente_cuerpo?: string | null;
  carta_hero_url?: string | null;
  carta_estilo_cards?: EstiloCards | null;
  carta_modo?: ModoCarta | null;
};

/** Carta completa lista para render público. */
export type CartaPublica = {
  empresa: CartaEmpresaPublica;
  categorias: Array<CartaCategoria & { items: CartaItem[] }>;
  destacados: CartaItem[];
};

/**
 * Catálogo UE 14 alérgenos — fuente ÚNICA en logística (PascalCase, valores
 * literales: "Gluten", "Lácteos", …). No duplicar la lista aquí; se re-exporta
 * para que la carta digital comparta exactamente los mismos valores que
 * productos/escandallos y puedan heredarse sin traducción.
 */
import type { AlergenoUE } from "@/features/logistica/data/productos";
export { ALERGENOS_UE_14 as ALERGENOS_UE } from "@/features/logistica/data/productos";
export type Alergeno = AlergenoUE;

export type EstadoCartaAdmin = "BORRADOR" | "PUBLICADA";

export type ToggleLikeResult =
  | { ok: true; liked: boolean; likesCount: number }
  | { ok: false; error: string; codigo: "RATE_LIMIT" | "NOT_FOUND" | "ERROR" };

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };
