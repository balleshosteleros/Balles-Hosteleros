/**
 * Contratos de la IMPORTACIÓN de albaranes (PRP-073 Fase 1).
 *
 * Una importación es cada intento de subir un albarán por foto/archivo: fila
 * persistente en `albaran_importaciones` con estado, huella y evidencia de
 * error. Este módulo es isomórfico (lo importan servidor y cliente): solo
 * tipos, códigos de error estables y sus mensajes en español.
 */

export type FlujoImportacionAlbaran = "libre" | "pedido";

export type EstadoImportacionAlbaran =
  | "pendiente_subida"
  | "subido"
  | "analizando"
  | "revisable"
  | "error"
  | "finalizado";

export type ErrorImportacionAlbaran =
  | "AUTH_EXPIRED"
  | "NO_ACTIVE_COMPANY"
  | "UNSUPPORTED_MEDIA"
  | "FILE_TOO_LARGE"
  | "UPLOAD_FAILED"
  | "OCR_FAILED"
  | "OCR_EMPTY"
  | "PERSIST_FAILED"
  | "DUPLICATE_FILE"
  | "NOT_FOUND";

/** Respuesta fallida estándar de las actions de importación. */
export interface FalloImportacion {
  ok: false;
  errorCode: ErrorImportacionAlbaran;
  /** Mensaje en español listo para mostrar a la persona (nunca técnico crudo). */
  message: string;
  /** Correlación con logs de Vercel/Gemini. Se muestra discreto en la UI. */
  traceId: string;
  /** true → tiene sentido ofrecer "Reintentar" sin repetir la foto. */
  retryable: boolean;
}

/** Mensajes por defecto por código (las actions pueden afinar el texto). */
export const MENSAJES_IMPORTACION: Record<ErrorImportacionAlbaran, string> = {
  AUTH_EXPIRED: "Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.",
  NO_ACTIVE_COMPANY: "No se pudo resolver tu empresa activa. Cierra sesión y vuelve a entrar.",
  UNSUPPORTED_MEDIA: "Formato no admitido. Usa una foto (JPG, PNG, WebP, HEIC) o un PDF.",
  FILE_TOO_LARGE: "El archivo es demasiado grande.",
  UPLOAD_FAILED: "La subida del archivo no llegó a completarse. Revisa la conexión y reintenta.",
  OCR_FAILED: "La IA no pudo leer el documento. Puedes reintentar sin repetir la foto.",
  OCR_EMPTY: "La IA no encontró líneas de producto. Prueba con una foto más nítida.",
  PERSIST_FAILED: "No se pudo guardar. Reintenta; si persiste, avisa a soporte con el código.",
  DUPLICATE_FILE: "Este documento ya está registrado.",
  NOT_FOUND: "No se encontró la importación. Vuelve a empezar el proceso.",
};

/** MIME admitidos para el documento del albarán. */
export const MIMES_ALBARAN = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export function esMimeAlbaranAdmitido(mime: string): boolean {
  return (MIMES_ALBARAN as readonly string[]).includes(mime.toLowerCase());
}

/**
 * Límite práctico del OCR: el documento viaja inline (base64) en la petición a
 * Gemini, que admite ~20 MB de request. Por encima de esto no es un problema de
 * subida (ya está en Storage) sino de análisis → error claro, no retryable.
 */
export const MAX_OCR_BYTES = 15 * 1024 * 1024;

/** traceId corto para correlacionar UI ↔ logs (no criptográfico). */
export function nuevoTraceId(): string {
  return `alb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
