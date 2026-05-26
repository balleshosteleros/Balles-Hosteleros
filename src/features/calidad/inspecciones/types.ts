/**
 * Tipos del módulo Inspecciones Propias.
 * Presentación (estilo Gamma) + plantilla del formulario + envíos públicos.
 */

// ─── Slides / presentación ──────────────────────────────────────────────

export type SlideLayout = "default" | "split-right" | "split-left" | "cover";
export type SlideBackground = "primary" | "secondary" | "neutral";

export type SlideBlock =
  | { id: string; type: "title"; text: string; href?: string | null }
  | { id: string; type: "subtitle"; text: string; href?: string | null }
  | { id: string; type: "paragraph"; text: string; href?: string | null }
  | { id: string; type: "bullets"; items: string[] }
  | {
      id: string;
      type: "numbered";
      items: { titulo: string; descripcion: string }[];
    }
  | {
      id: string;
      type: "cards";
      columns: 2 | 3 | 4;
      items: {
        titulo: string;
        descripcion: string;
        imagen?: string | null;
        imagen_focal_x?: number | null;
        imagen_focal_y?: number | null;
      }[];
    }
  | {
      id: string;
      type: "icon-row";
      items: { icono: string; titulo: string; descripcion: string }[];
    }
  | {
      id: string;
      type: "buttons";
      items: { label: string; href: string }[];
    }
  | {
      id: string;
      type: "image";
      src: string | null;
      alt?: string | null;
      focal_x?: number | null;
      focal_y?: number | null;
    }
  | { id: string; type: "note"; text: string }
  | { id: string; type: "divider" };

export interface Slide {
  id: string;
  layout: SlideLayout;
  background: SlideBackground;
  image: string | null;
  /** Punto focal de `image` (0-100 ambos ejes). Default 50/50 = centrado. */
  image_focal_x?: number | null;
  image_focal_y?: number | null;
  blocks: SlideBlock[];
}

export interface Presentacion {
  id: string;
  empresa_id: string;
  slides: Slide[];
  updated_at: string;
}

// ─── Plantilla del formulario ───────────────────────────────────────────

export type PreguntaTipo =
  | "texto_corto"
  | "texto_largo"
  | "fecha"
  | "telefono"
  | "escala"
  | "seleccion"
  | "empleado_select";

export interface EmpleadoPublico {
  id: string;
  nombre_completo: string;
  puesto: string | null;
  departamento: string | null;
}

/**
 * Valor serializado de una respuesta tipo `empleado_select`.
 * Se guarda como JSON en `inspeccion_respuestas.valor_texto` para
 * conservar puesto/departamento del momento de la inspección.
 */
export interface EmpleadoSeleccionado {
  empleado_id: string;
  nombre_completo: string;
  puesto: string | null;
  departamento: string | null;
}

export interface Pregunta {
  id: string;
  seccion_id: string;
  empresa_id: string;
  orden: number;
  tipo: PreguntaTipo;
  enunciado: string;
  ayuda: string | null;
  obligatoria: boolean;
  escala_min: number | null;
  escala_max: number | null;
  escala_label_min: string | null;
  escala_label_max: string | null;
  opciones: string[] | null;
  cuenta_para_nota: boolean;
}

export interface Seccion {
  id: string;
  version_id: string;
  empresa_id: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  preguntas: Pregunta[];
}

export interface PlantillaVersion {
  id: string;
  plantilla_id: string;
  empresa_id: string;
  version: number;
  estado: "borrador" | "publicada" | "archivada";
  vigente: boolean;
  publicada_at: string | null;
  publicada_por: string | null;
  created_at: string;
  secciones: Seccion[];
}

export interface Plantilla {
  id: string;
  empresa_id: string;
  numero_secuencial: number | null;
  nombre: string;
  descripcion: string | null;
  archivada: boolean;
  created_at: string;
  vigente_version: PlantillaVersion | null;
}

// ─── Envíos ─────────────────────────────────────────────────────────────

export interface EnvioResumen {
  id: string;
  numero_secuencial: number | null;
  nombre_inspector: string;
  nombre_jefe_sala: string | null;
  fecha_inspeccion: string | null;
  local_nombre: string | null;
  nota_final: number | null;
  notas_por_seccion: Record<string, number> | null;
  plantilla_id: string;
  plantilla_nombre: string | null;
  plantilla_version: number | null;
  estado: "pendiente_revision" | "revisado" | "archivado";
  verificado_at: string | null;
  verificado_por_nombre: string | null;
  created_at: string;
}

export interface RespuestaCompleta {
  id: string;
  pregunta_id: string | null;
  pregunta_snapshot: {
    seccion_titulo: string;
    seccion_orden: number;
    enunciado: string;
    tipo: PreguntaTipo;
    orden: number;
    escala_max: number | null;
  };
  valor_texto: string | null;
  valor_numero: number | null;
}

export interface EnvioCompleto {
  id: string;
  empresa_id: string;
  local_id: string | null;
  local_nombre: string | null;
  plantilla_id: string;
  plantilla_nombre: string | null;
  plantilla_version: number | null;
  version_id: string;
  numero_secuencial: number | null;
  nombre_inspector: string;
  telefono_inspector: string | null;
  fecha_inspeccion: string | null;
  nombre_jefe_sala: string | null;
  nota_final: number | null;
  notas_por_seccion: Record<string, number> | null;
  estado: "pendiente_revision" | "revisado" | "archivado";
  notas_calidad: string | null;
  verificado_at: string | null;
  verificado_por_empleado_id: string | null;
  verificado_por_nombre: string | null;
  created_at: string;
  respuestas: RespuestaCompleta[];
}

// ─── QR de verificación in-situ (PRP-041) ────────────────────────────

export interface QrTokenPublic {
  token: string;
  expires_at: string;
  verify_url: string;
}

export interface VerificacionResultado {
  ok: boolean;
  motivo?:
    | "no_session"
    | "no_empleado"
    | "local_no_coincide"
    | "token_caducado"
    | "token_usado"
    | "token_revocado"
    | "token_invalido"
    | "ya_verificado"
    | "dni_no_coincide"
    | "sin_jefe_sala_asignado"
    | "jefe_sala_sin_dni";
  envio?: {
    id: string;
    numero_secuencial: number | null;
    local_nombre: string | null;
    fecha_inspeccion: string | null;
    nombre_inspector: string;
    verificado_at?: string;
    verificado_por_nombre?: string;
  };
}

/**
 * Datos públicos del jefe de sala para la pantalla de firma por DNI.
 * Se exponen solo nombre y puesto para que se reconozca, NUNCA el DNI
 * completo.
 */
export interface JefeSalaFirma {
  envio_id: string;
  numero_secuencial: number | null;
  local_nombre: string | null;
  nombre_inspector: string;
  jefe_sala: {
    empleado_id: string;
    nombre_completo: string;
    puesto: string | null;
  } | null;
}

// ─── Token + datos públicos ─────────────────────────────────────────────

export interface InspeccionToken {
  empresa_id: string;
  token: string;
  activo: boolean;
  plantilla_activa_id: string | null;
}

export interface EmpresaTheme {
  id: string;
  nombre: string;
  logo_url: string | null;
  color: string | null;
  color_secundario: string | null;
  color_texto: string | null;
}

export interface LocalPublico {
  id: string;
  nombre: string;
  color: string | null;
}

export interface InspectorPublico {
  id: string;
  nombre_completo: string;
  telefono: string;
  email: string | null;
}

export interface InspeccionPublica {
  empresa: EmpresaTheme;
  locales: LocalPublico[];
  presentacion: Slide[];
  plantilla: {
    id: string;
    version_id: string;
    nombre: string;
    numero_secuencial: number | null;
    secciones: Seccion[];
  };
  empleados: EmpleadoPublico[];
  inspectores: InspectorPublico[];
}
