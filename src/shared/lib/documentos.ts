// Tope de tamaño UNIFICADO para documentos y justificantes que sube el usuario
// (cierres, albaranes, facturas, nóminas, modelos fiscales, contratos, firmas,
// documentación, procesos jurídicos...). La subida de estos va directa al bucket
// o a un endpoint de API (no a la Server Action con límite de 4.5 MB de Vercel).
//
// NO aplica a avatares, logos/branding ni vídeos: esos tienen su propio límite
// lógico (imágenes pequeñas) o se controlan por cuota de almacenamiento.
export const MAX_DOCUMENTO_MB = 50;
export const MAX_DOCUMENTO_BYTES = MAX_DOCUMENTO_MB * 1024 * 1024;

// Mensaje estándar cuando un archivo supera el tope.
export function mensajeDocumentoDemasiadoGrande(nombre?: string): string {
  return nombre
    ? `"${nombre}" supera el máximo de ${MAX_DOCUMENTO_MB} MB`
    : `El archivo supera el máximo de ${MAX_DOCUMENTO_MB} MB`;
}
