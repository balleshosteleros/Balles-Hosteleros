// Constantes de validación / cuotas para el módulo Documentación.
// Se mantienen en sync con la migración 097 + bucket allowed_mime_types.
// Vive en su propio módulo (no en *-actions.ts) para poder importarse
// desde Server Actions y desde componentes cliente.

export const ALLOWED_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export type AllowedMime = (typeof ALLOWED_MIMES)[number];

export const MAX_FILE_BYTES = 2 * 1024 * 1024;     // 2 MB por archivo
export const MAX_BYTES_EMPRESA = 8 * 1024 * 1024;  // 8 MB totales por empresa
export const MAX_DOCS_CARPETA = 50;
export const MAX_DOCS_EMPRESA = 50;

// Extensiones aceptadas por <input type="file" accept=...>
export const ACCEPT_FILE_EXTS = [
  ".pdf",
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".ppt", ".pptx",
  ".odt", ".ods", ".odp",
  ".txt", ".csv",
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif",
].join(",");

export function isAllowedMime(m: string): m is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(m);
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
