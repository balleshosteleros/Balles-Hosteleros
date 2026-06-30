// Modelo del Portal de Formación estilo "classroom" (tipo Skool):
// Curso → Secciones → Lecciones (cada lección es un vídeo + recursos).
// El portal del empleado y el panel admin de RRHH consumen los mismos tipos.

// Un "puesto" es ahora el nombre real de un puesto de la tabla `puestos`
// (antes era un enum hardcodeado; ahora se carga de BD por empresa).
export type Puesto = string;

/** Puesto real de la empresa (id + nombre): fuente de los cursos por puesto. */
export interface PuestoRef {
  id: string;
  nombre: string;
  /** Nombre del departamento del puesto (para clasificar por área Operativa/Administrativa). */
  departamento?: string;
}

export type Ambito = "general" | "puesto";

export type CategoriaCurso =
  | "bienvenida"
  | "cultura"
  | "protocolo"
  | "seguridad"
  | "operativa"
  | "atencion"
  | "otros";

// Curso = unidad principal en la pantalla de inicio del portal.
// Equivalente a un "Classroom" de Skool.
export interface Curso {
  id: string;
  titulo: string;
  descripcion: string;
  /** URL de la imagen de portada (placeholder admite gradiente CSS). */
  cover?: string;
  categoria: CategoriaCurso;
  ambito: Ambito;
  /** Sólo si ambito === "puesto": nombre del puesto (para mostrar/filtrar). */
  puesto?: Puesto;
  /** Sólo si ambito === "puesto": id real del puesto (vínculo de BD). */
  puestoId?: string;
  empresaId: string;
  orden: number;
  /** ISO yyyy-mm-dd — usado para destacar como novedad en los últimos 3 meses. */
  fechaPublicacion: string;
  autor: string;
  /** Si está despublicado, el empleado no lo ve, pero el admin sí. */
  publicado: boolean;
}

// Sección = bloque dentro de un curso. Aparece como divisor en la sidebar
// de lecciones de la vista classroom.
export interface Seccion {
  id: string;
  cursoId: string;
  titulo: string;
  orden: number;
  /** Texto libre del tema. */
  descripcion?: string;
  /** Si false, el tema y todas sus lecciones quedan ocultos al empleado. */
  publicado: boolean;
}

export interface RecursoLeccion {
  id: string;
  titulo: string;
  url: string;
  /** "pdf", "doc", "enlace", "imagen"… libre. */
  tipo: string;
}

// Lección = vídeo individual reproducible.
export interface Leccion {
  id: string;
  seccionId: string;
  cursoId: string;
  titulo: string;
  descripcion: string;
  /** URL del vídeo .mp4 (también vale embebible). */
  url: string;
  duracionMin: number;
  orden: number;
  fechaSubida: string;
  /** Si false, el empleado no ve esta lección. */
  publicado: boolean;
  /** URL/imagen de portada del vídeo (miniatura). */
  cover?: string;
  /** Texto libre adicional que se muestra bajo el vídeo. */
  contenido?: string;
  /** Documento adjunto (uno por tarea) en el bucket privado `formacion-docs`. */
  documentoPath?: string;
  documentoNombre?: string;
  /** "pdf" | "imagen" — para incrustarlo en la visual. */
  documentoTipo?: string;
  recursos: RecursoLeccion[];
}

// ─── Novedades ────────────────────────────────────────────────

export type TipoNovedad = "tarea" | "leccion" | "curso" | "cambio" | "aviso";

export interface NovedadFormacion {
  id: string;
  tipo: TipoNovedad;
  titulo: string;
  descripcion: string;
  audiencia: "todos" | Puesto[];
  fechaPublicacion: string;
  autor: string;
  empresaId: string;
  /** Enlace opcional a un curso o lección. */
  cursoId?: string;
  leccionId?: string;
}

// ─── Estado persistido en el store ────────────────────────────

export interface FormacionState {
  cursos: Curso[];
  secciones: Seccion[];
  lecciones: Leccion[];
  novedades: NovedadFormacion[];
  /** Marca de qué empleado completó qué lección. Clave: `${userKey}:${leccionId}`. */
  completadas: Record<string, boolean>;
}
