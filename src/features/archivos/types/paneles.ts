/**
 * Tipos que comparten las pantallas de Archivos con sus server actions.
 *
 * Viven AQUÍ y no junto a las acciones porque un fichero con "use server" solo
 * puede exportar funciones async: exportar una `interface` desde allí rompe en
 * producción el componente que la importa —y el build local NO lo avisa, así
 * que se descubre con la pantalla ya en blanco.
 */

/** Carpeta de primer nivel de una unidad compartida. */
export interface CarpetaRaizDrive {
  id: string;
  nombre: string;
  archivos: number;
  bytes: number;
}

/** Qué hay en la unidad, antes de importar nada. */
export interface Inventario {
  unidadId: string;
  unidadNombre: string;
  /** Carpetas de primer nivel: son las que se mapean a departamento. */
  carpetas: CarpetaRaizDrive[];
  /** Archivos sueltos en la raíz de la unidad, sin carpeta que los agrupe. */
  sueltos: number;
  sueltosBytes: number;
  totalArchivos: number;
  totalBytes: number;
}

/** Carpeta de Drive → id de la carpeta raíz de departamento en el software. */
export type Mapeo = Record<string, string>;

/** Estado de una importación, para la pantalla de progreso. */
export interface EstadoImportacion {
  id: string;
  unidadNombre: string;
  estado: string;
  copiados: number;
  copiadosBytes: number;
  omitidos: number;
  fallidos: number;
  errores: Array<{ archivo: string; motivo: string }>;
  createdAt: string;
}

/** Uso de almacenamiento de la empresa, para el panel de Ajustes. */
export interface UsoArchivos {
  /** Bytes ocupados por los archivos de la herramienta Archivos. */
  bytesArchivos: number;
  /** Bytes ocupados en total por la empresa (incluye grabaciones). */
  bytesTotal: number;
  /** Cuota contratada. */
  bytesLimite: number;
  /** Número de archivos guardados. */
  numArchivos: number;
  /** Desglose por departamento, de mayor a menor. */
  porDepartamento: Array<{ departamento: string; bytes: number; num: number }>;
}

/** Unidad compartida de Drive. */
export interface UnidadCompartidaUI {
  id: string;
  nombre: string;
}
