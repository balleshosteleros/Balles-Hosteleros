/**
 * Tipos del submódulo Inspectores (bolsa de empleo de inspectores externos).
 * PRP-040.
 */

export type InspectorFase =
  | "bolsa"
  | "entrevista"
  | "prueba"
  | "activo"
  | "historico"
  | "descartado";

export type InspectorEstadoActividad = "futuro" | "activo" | "historico";

export type InspectorOrigen = "formulario_publico" | "alta_manual" | "referido";

export interface InspectorDisponibilidad {
  dias?: string[];
  franja?: "manana" | "tarde" | "ambas";
  horario?: string;
  vehiculo_propio?: boolean;
  notas?: string;
}

export interface Inspector {
  id: string;
  empresa_id: string;
  numero_secuencial: number | null;

  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string;
  dni_nie: string | null;
  fecha_nacimiento: string | null;

  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  disponibilidad: InspectorDisponibilidad | null;

  cv_url: string | null;
  foto_url: string | null;

  fase: InspectorFase;
  estado_actividad: InspectorEstadoActividad;

  origen: InspectorOrigen;
  pagina_slug: string | null;

  notas: string | null;
  notas_internas: string | null;
  rating_interno: number | null;

  created_at: string;
  updated_at: string;
}

export interface InspectorListItem extends Inspector {
  num_inspecciones: number;
  ultima_inspeccion_at: string | null;
  nota_media: number | null;
}

export interface InspectorHistorialItem {
  envio_id: string;
  numero_secuencial: number | null;
  fecha_inspeccion: string | null;
  local_nombre: string | null;
  nota_final: number | null;
  estado: "pendiente_revision" | "revisado" | "archivado";
  verificado_at: string | null;
}

export interface InspectorDetalle extends Inspector {
  historial: InspectorHistorialItem[];
  num_inspecciones: number;
  nota_media: number | null;
}

// ─── Public bolsa ──────────────────────────────────────────────────────

// Campos toggleables del formulario público (nombre+apellidos y teléfono
// son siempre obligatorios por esquema y no se pueden desactivar).
export type BolsaCampoKey =
  | "email"
  | "ciudad"
  | "horario_disponibilidad"
  | "vehiculo_propio";

export type BolsaCamposActivos = Record<BolsaCampoKey, boolean>;

export const BOLSA_CAMPOS_DEFAULTS: BolsaCamposActivos = {
  email: true,
  ciudad: true,
  horario_disponibilidad: true,
  vehiculo_propio: true,
};

export const BOLSA_CAMPOS_OBLIGATORIOS: Record<BolsaCampoKey, boolean> = {
  email: true,
  ciudad: true,
  horario_disponibilidad: false,
  vehiculo_propio: false,
};

export const BOLSA_CAMPOS_LABELS: Record<BolsaCampoKey, string> = {
  email: "Email",
  ciudad: "Ciudad",
  horario_disponibilidad: "Disponibilidad horaria",
  vehiculo_propio: "Vehículo propio",
};

export function mergeCamposActivos(
  raw: Partial<BolsaCamposActivos> | null | undefined,
): BolsaCamposActivos {
  return { ...BOLSA_CAMPOS_DEFAULTS, ...(raw ?? {}) };
}

export interface BolsaConfig {
  activa: boolean;
  titulo_seccion: string;
  titulo_principal: string;
  descripcion: string;
  mensaje_exito_titulo: string;
  mensaje_exito_texto: string;
  texto_boton: string;
  color_fondo: string | null;
  color_acento: string | null;
  color_texto: string | null;
  campos_activos: BolsaCamposActivos;
}

export const BOLSA_CONFIG_DEFAULTS: BolsaConfig = {
  activa: true,
  titulo_seccion: "Bolsa de inspectores",
  titulo_principal: "Únete a nuestra bolsa de inspectores",
  descripcion:
    "Realiza inspecciones puntuales en nuestros locales. Cuéntanos quién eres y nos pondremos en contacto contigo.",
  mensaje_exito_titulo: "¡Inscripción recibida!",
  mensaje_exito_texto:
    "Gracias. Hemos guardado tus datos y nos pondremos en contacto cuando necesitemos un inspector.",
  texto_boton: "Inscribirme en la bolsa",
  color_fondo: null,
  color_acento: null,
  color_texto: null,
  campos_activos: { ...BOLSA_CAMPOS_DEFAULTS },
};

export interface BolsaPublicaEmpresa {
  empresa: {
    id: string;
    slug: string;
    nombre: string;
    logo_url: string | null;
    color: string | null;
    color_secundario: string | null;
    color_texto: string | null;
  };
  config: BolsaConfig;
}

export interface InscripcionPublicaInput {
  empresa_slug: string;
  nombre: string;
  apellidos?: string | null;
  email?: string | null;
  telefono: string;
  ciudad?: string | null;
  provincia?: string | null;
  disponibilidad?: InspectorDisponibilidad | null;
  horario_disponibilidad?: string | null;
  vehiculo_propio?: boolean | null;
  notas?: string | null;
  cv_url?: string | null;
}
