import type { AppRole } from "@/features/auth/contexts/auth-context";

export interface Faq {
  id: string;
  categoria: string;
  pregunta: string;
  respuesta: string;
  visible_para: AppRole[];
  orden: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface FaqInput {
  categoria: string;
  pregunta: string;
  respuesta: string;
  visible_para: AppRole[];
  orden?: number;
}

export interface FaqsByCategory {
  categoria: string;
  faqs: Faq[];
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

export type FuenteConocimiento = "formacion" | "manual";

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
