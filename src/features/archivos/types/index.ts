/**
 * PRP-079 — Archivos: el Drive propio del software.
 *
 * Almacén de archivos de la empresa en Cloudflare R2, con una carpeta raíz por
 * departamento y subcarpetas libres dentro. Sustituye a Google Drive.
 *
 * Admite CUALQUIER tipo de archivo (fotos, vídeos, PDF, hojas de cálculo,
 * documentos…) y cualquier tamaño: el único límite es la cuota contratada por
 * la empresa.
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

/**
 * NO hay lista de tipos permitidos ni tope por archivo (decisión de Iván,
 * 27-ago-2026): aquí cabe cualquier documento —foto, vídeo, PDF, hoja de
 * cálculo, lo que sea— y del peso que haga falta.
 *
 * El único límite es la CUOTA DE LA EMPRESA, que se comprueba en el servidor
 * antes de firmar cada subida. Poner además un tope por archivo solo serviría
 * para rechazar un vídeo largo que sí cabe en la cuota contratada.
 *
 * Que no haya límite por archivo es posible porque la subida va DIRECTA del
 * navegador a R2 con URL firmada: el archivo nunca pasa por el servidor, así
 * que no aplica el límite de tamaño de petición de Vercel.
 */

export const esVideo = (mime: string) => mime.startsWith("video/");
export const esImagen = (mime: string) => mime.startsWith("image/");

/** ¿Se puede mostrar una vista previa? El resto se pinta con un icono. */
export const tieneVistaPrevia = (mime: string) =>
  esImagen(mime) || esVideo(mime);
