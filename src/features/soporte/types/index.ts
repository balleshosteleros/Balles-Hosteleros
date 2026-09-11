/**
 * Preguntas frecuentes. Las escribe el software solo a partir de lo que la
 * gente pregunta al asistente; también se pueden escribir a mano desde
 * Dirección. Son de cada empresa y llevan un módulo, que es lo que decide
 * quién las ve.
 */
export interface Faq {
  id: string;
  /** Nombre canónico de módulo. De aquí sale el candado de rol. */
  modulo: string;
  pregunta: string;
  respuesta: string;
  /** Cuántas veces se ha preguntado lo mismo. Es el orden de la lista. */
  veces_preguntada: number;
  origen: "ia" | "manual";
  estado: "publicada" | "borrador" | "archivada";
  created_at: string;
  updated_at: string;
}

export interface FaqInput {
  modulo: string;
  pregunta: string;
  respuesta: string;
  estado?: "publicada" | "borrador" | "archivada";
}

/** Preguntas agrupadas por módulo, tal como se pintan en Ayuda. */
export interface FaqsByCategory {
  categoria: string;
  faqs: Faq[];
}

/** Lo que la gente pregunta y el software todavía no sabe contestar. */
export interface HuecoConocimiento {
  id: string;
  pregunta: string;
  veces_preguntada: number;
  modulo_probable: string | null;
  estado: "abierto" | "resuelto" | "descartado";
  created_at: string;
  updated_at: string;
}

// ─── Base de conocimiento RAG (PRP-055) ───────────────────────

export interface RecursoEnlace {
  titulo: string;
  url: string;
}

export interface RecursoVideo {
  titulo: string;
  url: string;
  duracion_min?: number;
}

/**
 * De dónde sale un artículo del asistente:
 *  - "software": el manual, que viaja con el código y se reindexa al desplegar.
 *  - "manual": escrito a mano desde Dirección.
 *  - "formacion": sacado del contenido de Formación.
 */
export type FuenteConocimiento = "software" | "formacion" | "manual";

export interface ConocimientoChunk {
  id: string;
  fuente: FuenteConocimiento;
  origen_ref: string | null;
  modulo: string;
  departamento: string | null;
  puesto: string | null;
  titulo: string;
  contenido: string;
  enlaces: RecursoEnlace[];
  videos: RecursoVideo[];
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/** Input del panel admin para artículos escritos a mano. */
export interface ConocimientoManualInput {
  modulo: string;
  titulo: string;
  contenido: string;
  enlaces?: RecursoEnlace[];
  videos?: RecursoVideo[];
  activo?: boolean;
}

/** Recurso recuperado que acompaña a una respuesta del bot. */
export interface RecursoRespuesta {
  tipo: "video" | "enlace";
  titulo: string;
  url: string;
}
