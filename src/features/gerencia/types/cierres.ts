// Constantes compartidas del submódulo Cierres (Gerencia).
// Vive fuera de los server actions ("use server" solo puede exportar funciones async).

// Tope de documentos adjuntos por cierre/ingreso.
export const MAX_DOCUMENTOS_CIERRE = 3;

// Tamaño máximo por documento: fuente única compartida (50 MB) en
// `@/shared/lib/documentos`. La subida es directa al bucket (URL firmada),
// así que no aplica el límite de 4.5 MB de las Server Actions.
export { MAX_DOCUMENTO_MB as MAX_TAMANO_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES as MAX_TAMANO_DOCUMENTO_BYTES } from "@/shared/lib/documentos";
