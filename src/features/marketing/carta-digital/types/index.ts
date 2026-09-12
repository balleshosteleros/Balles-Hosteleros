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

export type FamiliaCarta = "comida" | "bebida" | "otros";

/**
 * Apartado del primer nivel de la carta. Son tres como máximo: más opciones
 * aquí convierten la elección en otra lista que leer, que es lo que esta
 * pantalla venía a evitar. El nombre y el orden los decide cada empresa
 * (BACANAL abre por comida; HABANA, que es coctelería, por bebida).
 */
export type CartaFamilia = {
  clave: FamiliaCarta;
  nombre: string;
  orden: number;
  visible: boolean;
};

export type CartaCategoria = {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  visible: boolean;
  /** COMIDA, BEBIDA u OTROS (shishas, vapers): primer nivel de la carta. */
  familia: FamiliaCarta | null;
  /** Formato de foto de esta categoría. null = el de la carta. */
  formato_foto?: FormatoFoto | null;
  /** Dietas especiales (celíacos, veganos, niños): botón con estilo propio. */
  destacada: boolean;
  /**
   * Ventana de disponibilidad, configurable desde el panel. El menú del día
   * solo existe a sus horas: enseñarlo cuando no se sirve es prometer algo que
   * no hay. `null` en los tres campos = siempre visible. La hora de fin puede
   * ser menor que la de inicio: entonces la ventana cruza la medianoche.
   */
  dias_semana: number[] | null;
  hora_desde: string | null;
  hora_hasta: string | null;
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
  /**
   * Arranque configurable que se SUMA al contador visible. No es un voto: las
   * estadísticas se calculan solo sobre los "me gusta" reales.
   */
  likes_base: number;
  /**
   * Se ha acabado HOY. Lo marca cocina durante el servicio y se quita solo
   * cuando arranca el día siguiente. El plato no desaparece: sale en gris y
   * con el rótulo "Agotado", para que el comensal no lo pida.
   */
  agotado: boolean;
  /**
   * Nombre REAL del producto de venta al que está vinculado, solo para
   * enseñarlo de referencia en el panel: el plato puede llamarse en la carta
   * de otra forma, y hay que poder ver de qué producto se trata. No se guarda
   * aquí; vive en la ficha del producto. Solo lo rellena la lectura admin.
   */
  producto_nombre?: string | null;
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

/**
 * Proporción con la que se enseñan las fotos de una categoría.
 *
 * Lo decide la casa, no el archivo: con la proporción de cada foto, las
 * tarjetas de una misma fila salían a distinta altura y la rejilla quedaba
 * descuadrada. Se elige por categoría porque no todo se fotografía igual, y
 * dentro de cada una todas comparten formato: eso es lo que hace que la fila
 * cuadre.
 *
 * Solo dos formas, y ninguna apaisada: la foto tiene que ganar altura en la
 * tarjeta para que el plato se vea. La cuadrada va bien a la comida, que se
 * fotografía a lo ancho, y la vertical a copas y botellas.
 */
export type FormatoFoto = "cuadrada" | "vertical";

export const PROPORCION_FORMATO: Record<FormatoFoto, number> = {
  cuadrada: 1,
  // 2:3, que es justo como se disparan las fotos de copa. A 3:4 había que
  // recortar y lo que se perdía era el pie de la copa: el cóctel salía
  // flotando. Así entran enteras, sin tocar nada.
  vertical: 2 / 3,
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
  isotipo_url?: string | null;
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
  /** Formato por defecto; cada categoría puede pisarlo. */
  carta_formato_foto?: FormatoFoto | null;
};

/** Carta completa lista para render público. */
export type CartaPublica = {
  empresa: CartaEmpresaPublica;
  familias: CartaFamilia[];
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
