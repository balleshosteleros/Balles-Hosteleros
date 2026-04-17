export type Layout =
  | "portada"
  | "bullets"
  | "cita"
  | "comparacion"
  | "imagen"
  | "cierre";

export type Tono = "formal" | "cercano" | "motivacional" | "tecnico";

export type Estado = "borrador" | "generando" | "listo" | "fallida" | "archivada";

export interface Branding {
  empresa_id: string;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  color_fondo: string;
  color_texto: string;
  tipografia_titulo: string;
  tipografia_cuerpo: string;
  fondo_url: string | null;
  updated_at?: string;
}

export interface Slide {
  id: string;
  presentacion_id: string;
  orden: number;
  layout: Layout;
  titulo: string | null;
  contenido: {
    bullets?: string[];
    cuerpo?: string;
    cita?: string;
    comparacion?: { izquierda: string[]; derecha: string[]; tituloIzq?: string; tituloDer?: string };
    imagen_prompt?: string;
  };
  notas: string | null;
}

export interface Presentacion {
  id: string;
  empresa_id: string;
  titulo: string;
  prompt_original: string;
  audiencia: string | null;
  tono: Tono;
  idioma: string;
  num_slides: number;
  estado: Estado;
  error_mensaje: string | null;
  modelo_ia: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  branding_snapshot: Branding | Record<string, never>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PresentacionConSlides extends Presentacion {
  slides: Slide[];
}

export interface GenerarInput {
  prompt: string;
  audiencia?: string;
  numSlides: number;
  tono: Tono;
  idioma: string;
}
