/**
 * Traduce errores técnicos (Supabase, Next.js, red…) a mensajes en español
 * pensados para usuarios finales sin conocimiento técnico.
 */
export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const text = raw.toLowerCase();

  // Tamaño de archivo
  if (text.includes("body exceeded") || text.includes("payload too large") || text.includes("body size")) {
    return "El archivo es demasiado grande. Usa una imagen más pequeña (máx. 5 MB).";
  }
  if (text.includes("file size") && text.includes("exceed")) {
    return "El archivo supera el tamaño permitido.";
  }

  // Formato no soportado
  if (text.includes("mime type") || text.includes("invalid file type") || text.includes("unsupported")) {
    return "Formato no permitido. Usa PNG, JPG, SVG o WebP.";
  }

  // Permisos / RLS
  if (text.includes("row-level security") || text.includes("rls") || text.includes("permission denied") || text.includes("not authorized")) {
    return "No tienes permisos para realizar esta acción.";
  }

  // Sesión / autenticación
  if (text.includes("jwt") || text.includes("not authenticated") || text.includes("unauthenticated")) {
    return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  }
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "Email o contraseña incorrectos.";
  }

  // Conectividad
  if (text.includes("network") || text.includes("failed to fetch") || text.includes("offline") || text.includes("timeout")) {
    return "Sin conexión. Comprueba tu internet e inténtalo de nuevo.";
  }

  // Bucket / Storage no encontrado
  if (text.includes("bucket not found")) {
    return "Almacenamiento no configurado. Contacta con soporte.";
  }
  if (text.includes("not found")) {
    return "Recurso no encontrado.";
  }

  // Conflictos
  if (text.includes("duplicate") || text.includes("already exists") || text.includes("unique constraint")) {
    return "Ya existe un registro con esos datos.";
  }

  // Validación
  if (text.includes("required") || text.includes("not null")) {
    return "Faltan campos obligatorios.";
  }

  // Por defecto: mensaje neutro
  return "Ha ocurrido un error. Inténtalo de nuevo.";
}
