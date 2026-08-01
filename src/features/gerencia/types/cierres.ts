// Constantes compartidas del submódulo Cierres (Gerencia).
// Vive fuera de los server actions ("use server" solo puede exportar funciones async).

// Tope de documentos adjuntos por cierre/ingreso.
export const MAX_DOCUMENTOS_CIERRE = 3;

// Tamaño máximo por documento. La subida es directa al bucket (URL firmada),
// así que no aplica el límite de 4.5 MB de las Server Actions; fijamos un tope
// generoso para fotos de móvil/PDF y avisamos si se supera.
export const MAX_TAMANO_DOCUMENTO_MB = 50;
export const MAX_TAMANO_DOCUMENTO_BYTES = MAX_TAMANO_DOCUMENTO_MB * 1024 * 1024;
