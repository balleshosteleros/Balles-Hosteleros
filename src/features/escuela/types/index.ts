/**
 * ESCUELA — portal de alumnos.
 *
 * El CONTENIDO (cursos → módulos → lecciones) reutiliza los tipos de
 * `features/formacion`: son las mismas tablas con `ambito = 'escuela'`.
 * Aquí viven solo las piezas propias de la escuela: las clases del calendario
 * y el alumno.
 */

export type TipoClase = "CLASE" | "DIRECTO" | "TALLER" | "TUTORIA" | "OTRO";

export const TIPOS_CLASE: { valor: TipoClase; etiqueta: string }[] = [
  { valor: "CLASE", etiqueta: "Clase" },
  { valor: "DIRECTO", etiqueta: "Directo" },
  { valor: "TALLER", etiqueta: "Taller" },
  { valor: "TUTORIA", etiqueta: "Tutoría" },
  { valor: "OTRO", etiqueta: "Otro" },
];

/** Clase en directo del calendario. Fecha y hora en la zona de la empresa. */
export interface ClaseEscuela {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoClase;
  /** yyyy-mm-dd */
  fecha: string;
  /** HH:mm */
  horaInicio: string;
  /** HH:mm — opcional: una clase puede no tener hora de fin. */
  horaFin?: string;
  /** Dónde se da (Zoom/Meet/YouTube en directo). */
  enlace?: string;
  /** Dónde queda grabada después. */
  grabacionUrl?: string;
  /** Miniatura propia. Vacía = se pinta la de marca. */
  cover?: string;
  cursoId?: string;
  publicado: boolean;
}

export type EstadoAlumno = "ACTIVO" | "INACTIVO";

export interface AlumnoEscuela {
  id: string;
  email: string;
  nombre: string;
  telefono?: string;
  /** Empresa cliente del alumno (la que tiene el software contratado). */
  empresaClienteId?: string;
  empresaClienteNombre?: string;
  /**
   * Su ficha de cliente en la matriz. Casi todos los alumnos ya estaban ahí
   * como clientes: es la misma persona con dos fichas, y el enlace deja ir de
   * una a otra sin buscarla a mano.
   */
  clienteId?: string;
  clienteNombre?: string;
  /** Veces que ha entrado en la escuela. */
  accesosNum: number;
  /** true = ve todos los cursos publicados; false = solo los matriculados. */
  accesoTotal: boolean;
  estado: EstadoAlumno;
  origen: string;
  ultimoAccesoAt?: string;
  createdAt: string;
  /** Ids de curso en los que está matriculado (solo cuenta si accesoTotal=false). */
  cursosMatriculados: string[];
  /** Lecciones completadas, para el porcentaje del back-office. */
  leccionesCompletadas: number;
}

/** Lo que ve el alumno de sí mismo en el portal (solo lectura). */
export interface PerfilAlumno {
  nombre: string;
  email: string;
  telefono?: string;
  empresaClienteNombre?: string;
  altaEl: string;
  cursosActivos: number;
  leccionesCompletadas: number;
}
