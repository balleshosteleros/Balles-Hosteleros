/**
 * PRP-079 — Archivos: el Drive propio del software.
 *
 * Almacén de fotos y vídeos de la empresa en Cloudflare R2, con una carpeta
 * raíz por departamento y subcarpetas libres dentro. Sustituye a Google Drive.
 */

/** Carpeta del explorador. Las raíz (`esRaiz`) son las de departamento. */
export interface Carpeta {
  id: string;
  nombre: string;
  parentId: string | null;
  /** Clave CANÓNICA del departamento (bh_canon): RRHH, LOGISTICA… */
  departamento: string;
  esRaiz: boolean;
  createdAt: string;
}

/** Archivo almacenado en R2. */
export interface Archivo {
  id: string;
  carpetaId: string;
  departamento: string;
  nombre: string;
  r2Key: string;
  miniaturaKey: string | null;
  mime: string;
  tamanoBytes: number;
  ancho: number | null;
  alto: number | null;
  duracionSeg: number | null;
  subidoPor: string | null;
  /** Calculado en servidor: ¿el usuario actual puede borrarlo? */
  puedeBorrar: boolean;
  createdAt: string;
}

/** Contenido de una carpeta: sus subcarpetas y sus archivos. */
export interface ContenidoCarpeta {
  carpeta: Carpeta | null;
  /** Ruta desde la raíz hasta la carpeta actual, para la miga de pan. */
  ruta: Carpeta[];
  subcarpetas: Carpeta[];
  archivos: Archivo[];
}

export interface PresignOutput {
  uploadUrl: string;
  r2Key: string;
  miniaturaUploadUrl: string;
  miniaturaKey: string;
}

/** Datos del archivo ya subido, para registrarlo en la base de datos. */
export interface RegistrarArchivoInput {
  carpetaId: string;
  nombre: string;
  r2Key: string;
  miniaturaKey: string | null;
  mime: string;
  tamanoBytes: number;
  ancho?: number | null;
  alto?: number | null;
  duracionSeg?: number | null;
}

/** Tipos que la galería acepta. Solo foto y vídeo: no es un gestor documental. */
export const MIME_PERMITIDOS = /^(image|video)\//;

/**
 * Tope por archivo: 2 GB.
 *
 * NO son los 50 MB de los documentos: aquel límite existe porque los PDF pasan
 * por Supabase Storage, mientras que aquí el archivo va DIRECTO del móvil a R2
 * con URL firmada, igual que las grabaciones. Un vídeo de un minuto grabado con
 * un iPhone ronda los 100-170 MB, así que 50 MB dejaría fuera casi cualquier
 * vídeo. El límite real que manda es la cuota de 500 GB por empresa.
 */
export const MAX_BYTES_ARCHIVO = 2 * 1024 * 1024 * 1024;

export const esVideo = (mime: string) => mime.startsWith("video/");
export const esImagen = (mime: string) => mime.startsWith("image/");
