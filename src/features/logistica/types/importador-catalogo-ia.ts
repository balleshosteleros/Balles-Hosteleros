import type { PayloadExtraido } from "@/features/logistica/types/importador-ia";

/**
 * Definición de un campo del catálogo a importar.
 *
 * - `texto`: input editable libre (nombre, email, teléfono, etc.).
 * - `select`: dropdown restringido a `opciones`. Sirve para campos con catálogo
 *   cerrado o dinámico (categoría, estado, etc.). Si la IA propone algo fuera
 *   de la lista, el saneamiento server-side lo descarta y la UI obliga a elegir.
 */
export interface CampoCatalogo {
  /** Clave usada en el JSON que devuelve la IA y en el payload de guardado. */
  key: string;
  /** Etiqueta visible en el header de la tabla de revisión. */
  label: string;
  /** Si true, el botón "Guardar" se bloquea hasta que todas las filas lo tengan. */
  obligatorio: boolean;
  tipo: "texto" | "select";
  /** Solo para `tipo='select'`: catálogo de opciones permitidas. */
  opciones?: ReadonlyArray<{ value: string; label: string }>;
  /** Mensaje cuando `opciones` está vacío (típico de catálogos dinámicos por empresa). */
  placeholderVacio?: string;
  /** Si true y `opciones` está vacío, el select se desactiva forzando al usuario a crear catálogo antes. */
  deshabilitadoSiVacio?: boolean;
  /** Hint corto bajo el label en el header (opcional). */
  hint?: string;
}

/** Una fila genérica del catálogo en revisión. */
export interface FilaCatalogoSugerida {
  tempId: string;
  /** Valores extraídos por la IA. Cualquier campo puede ser null. */
  valores: Record<string, string | null>;
  /** Confianza 0-1 por campo. Opcional. */
  confianza?: Record<string, number>;
}

export interface AnalisisCatalogoResultado {
  filas: FilaCatalogoSugerida[];
  /** Aviso global de la IA (max 200 chars). */
  resumen?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  modelo?: string | null;
}

/**
 * Contrato que cada entidad implementa para alimentar el dialog genérico.
 * - `analyze`: server action que recibe el payload extraído del archivo
 *   y devuelve filas sugeridas.
 * - `save`: server action que recibe las filas confirmadas y las inserta
 *   en su tabla. Devuelve cuántas se importaron o un error.
 */
export interface ImportadorEntityConfig {
  /** Título mostrado en el header del dialog. */
  titulo: string;
  /** Subtítulo descriptivo (puede mencionar dónde gestionar los catálogos). */
  subtitulo?: string;
  campos: CampoCatalogo[];
  analyze: (
    payload: PayloadExtraido,
  ) => Promise<{ error?: string; resultado?: AnalisisCatalogoResultado }>;
  save: (
    rows: Array<Record<string, string | null>>,
  ) => Promise<{ error?: string; imported?: number }>;
}
