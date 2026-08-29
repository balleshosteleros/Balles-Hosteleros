// Tope de tamaño UNIFICADO para documentos y justificantes que sube el usuario
// (cierres, albaranes, facturas, nóminas, modelos fiscales, contratos, firmas,
// documentación, procesos jurídicos...). La subida de estos va directa al bucket
// o a un endpoint de API (no a la Server Action con límite de 4.5 MB de Vercel).
//
// NO aplica a avatares, logos/branding ni vídeos: esos tienen su propio límite
// lógico (imágenes pequeñas) o se controlan por cuota de almacenamiento.
export const MAX_DOCUMENTO_MB = 50;
export const MAX_DOCUMENTO_BYTES = MAX_DOCUMENTO_MB * 1024 * 1024;

// Tope del ANÁLISIS por IA de nóminas (lectura con visión), MÁS BAJO que el de
// documentos: guardar un PDF de 50 MB es viable, pero por encima de esto el modelo
// no lo procesa de forma fiable. Vive aquí —y no en el servicio, que es
// `server-only`— para que la pantalla de subida pueda avisar ANTES de subir en vez
// de que el servidor lo rechace después.
export const MAX_NOMINAS_MB = 25;
export const MAX_NOMINAS_BYTES = MAX_NOMINAS_MB * 1024 * 1024;

// Tope de IMÁGENES sueltas y ficheros ligeros: avatar, logos (app y empresa),
// fotos de carta/inspección/cata, y CV de candidatos. Se mantiene bajo a
// propósito (10 MB) para no tener muchos valores distintos y proteger la cuota
// en formularios públicos.
export const MAX_IMAGEN_MB = 10;
export const MAX_IMAGEN_BYTES = MAX_IMAGEN_MB * 1024 * 1024;

// Formatos que el almacenamiento acepta de verdad para imágenes de marca.
// El selector de archivos ofrecía `image/*`, así que el móvil colaba HEIC y el
// navegador AVIF/GIF: el archivo se elegía bien y fallaba después al subirlo,
// con un "Ha ocurrido un error" que no decía nada. Esta es la lista real.
export const IMAGEN_MIME_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
] as const;

// Para el atributo `accept` del input: el mismo criterio que valida la subida.
export const IMAGEN_ACCEPT = IMAGEN_MIME_PERMITIDOS.join(",");

/** Nombres de formato para el usuario: "PNG, JPG, SVG o WebP". */
export const IMAGEN_FORMATOS_TEXTO = "PNG, JPG, SVG o WebP";

/** ¿El almacenamiento acepta este archivo? Vale el tipo o, si viene vacío, la extensión. */
export function esImagenPermitida(file: File): boolean {
  const tipo = file.type.toLowerCase();
  if (tipo) return (IMAGEN_MIME_PERMITIDOS as readonly string[]).includes(tipo);
  // Algunos navegadores no rellenan `type`; caemos a la extensión.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "svg", "webp"].includes(ext);
}

// Mensaje estándar cuando un archivo supera el tope.
export function mensajeDocumentoDemasiadoGrande(nombre?: string): string {
  return nombre
    ? `"${nombre}" supera el máximo de ${MAX_DOCUMENTO_MB} MB`
    : `El archivo supera el máximo de ${MAX_DOCUMENTO_MB} MB`;
}

// Traduce a español CUALQUIER error de subida al almacén. Su misión principal es
// que un archivo rechazado por tamaño NUNCA muestre un mensaje técnico en inglés
// (p. ej. "Payload too large", "exceeded the maximum allowed size", error 413):
// siempre un aviso claro de por qué no se pudo subir. Devuelve `fallback` (o un
// mensaje genérico en español) si el error no es de tamaño.
export function traducirErrorSubida(error: unknown, fallback?: string): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message ?? "")
        : "";
  const txt = raw.toLowerCase();

  const esDeTamano =
    txt.includes("payload too large") ||
    txt.includes("exceeded the maximum") ||
    txt.includes("maximum allowed size") ||
    txt.includes("max file size") ||
    txt.includes("file size") ||
    txt.includes("too large") ||
    txt.includes("413") ||
    txt.includes("entity too large");

  if (esDeTamano) {
    return `El archivo es demasiado grande y no se ha podido subir (máximo ${MAX_DOCUMENTO_MB} MB para documentos, ${MAX_IMAGEN_MB} MB para imágenes).`;
  }
  // Si ya viene en español o es descriptivo, respétalo; si no, mensaje genérico.
  return raw && /[áéíóúñ ]/.test(raw) ? raw : (fallback ?? "No se ha podido subir el archivo. Inténtalo de nuevo.");
}
