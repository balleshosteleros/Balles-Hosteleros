export type AuditoriaTipoPregunta =
  | 'escala'
  | 'texto_largo'
  | 'si_no'
  | 'opcion_unica'
  | 'opcion_multiple'
  | 'observaciones';

export type AuditoriaEstadoVersion = 'borrador' | 'publicada';
export type AuditoriaEstadoEnvio = 'borrador' | 'enviada';

export interface AuditoriaPlantilla {
  id: string;
  empresa_id: string;
  numero_secuencial: number;
  nombre: string;
  descripcion: string | null;
  clonada_de_plantilla_id: string | null;
  archivada: boolean;
  created_at: string;
  created_by: string | null;
}

export interface AuditoriaVersion {
  id: string;
  plantilla_id: string;
  version: number;
  estado: AuditoriaEstadoVersion;
  vigente: boolean;
  publicada_at: string | null;
  publicada_por: string | null;
  created_at: string;
}

export interface AuditoriaSeccion {
  id: string;
  version_id: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
}

export interface AuditoriaPregunta {
  id: string;
  seccion_id: string;
  orden: number;
  numero_global: number;
  tipo: AuditoriaTipoPregunta;
  texto: string;
  obligatoria: boolean;
  peso: number;
  escala_min: number | null;
  escala_max: number | null;
  etiqueta_min: string | null;
  etiqueta_max: string | null;
  opciones: string[] | null;
}

export interface AuditoriaEnvio {
  id: string;
  empresa_id: string;
  numero_secuencial: number;
  plantilla_id: string;
  version_id: string;
  local_id: string;
  auditor_empleado_id: string;
  fecha: string;
  estado: AuditoriaEstadoEnvio;
  nota_final: number | null;
  enviada_at: string | null;
  created_at: string;
}

export interface AuditoriaRespuesta {
  id: string;
  envio_id: string;
  pregunta_id: string;
  valor_numero: number | null;
  valor_texto: string | null;
  valor_opciones: string[] | null;
}

export interface AuditoriaPlantillaCompleta extends AuditoriaPlantilla {
  versiones: AuditoriaVersion[];
  versionVigente: AuditoriaVersion | null;
}

export interface AuditoriaVersionCompleta extends AuditoriaVersion {
  secciones: Array<AuditoriaSeccion & { preguntas: AuditoriaPregunta[] }>;
}

export interface AuditoriaEnvioCompleto extends AuditoriaEnvio {
  respuestas: AuditoriaRespuesta[];
}
