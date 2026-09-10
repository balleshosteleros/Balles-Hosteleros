/**
 * Documentos adjuntos de un comunicado: tipos y constantes compartidas.
 *
 * Vive aparte de las acciones y del servicio de correo porque lo necesitan los
 * tres lados: la pantalla de Gerencia que los sube, el portal del empleado que
 * los abre, y el correo que los manda. Sin `server-only`, para que la pantalla
 * pueda avisar del tamaño ANTES de subir en vez de que el servidor lo rechace
 * después.
 */

/** Bucket privado donde viven los adjuntos. La carpeta raíz es la empresa. */
export const BUCKET_COMUNICADOS = "comunicados-adjuntos";

/** Cuántos documentos se pueden colgar de un mismo comunicado. */
export const MAX_ADJUNTOS_COMUNICADO = 10;

/** Documento ya subido al bucket. La BD guarda exactamente esto en `adjuntos`. */
export interface ComunicadoAdjunto {
  /** Ruta dentro del bucket. Es lo que se firma para abrirlo. */
  path: string;
  /** Nombre original del archivo, el que ve el trabajador. */
  name: string;
  /** Tamaño en bytes. 0 si no se pudo determinar. */
  size: number;
  /** Tipo de archivo (MIME). `null` si el navegador no lo rellenó. */
  mime: string | null;
}

/** Enlace del software que abre el documento (firma en el momento del clic). */
export function urlAdjuntoComunicado(path: string): string {
  return `/api/comunicados/doc?path=${encodeURIComponent(path)}`;
}

/** Tamaño legible: "1,4 MB". Coma decimal, como en el resto del software. */
export function tamanoLegible(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} KB`;
}
