/**
 * Detalle técnico de un error de Supabase (`code`, `details`, `hint`), que no
 * viaja en `message` y es justo lo que dice qué hacer para arreglarlo.
 */
function detalleSupabase(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const e = err as Record<string, unknown>;
  const partes = (["code", "details", "hint"] as const)
    .map((k) => (typeof e[k] === "string" && e[k] ? `${k}=${e[k] as string}` : ""))
    .filter(Boolean);
  return partes.length > 0 ? ` (${partes.join(" · ")})` : "";
}

/**
 * Traduce errores técnicos (Supabase, Next.js, red…) a mensajes en español
 * pensados para usuarios finales sin conocimiento técnico.
 *
 * Y DEJA CONSTANCIA del error real en el log del servidor. El mensaje amable es
 * para el usuario; sin esta traza, la causa se perdía por completo: una lista
 * entera caída se veía como "Ha ocurrido un error" y averiguar el motivo exigía
 * reproducir la consulta a mano. Pasó con el embed ambiguo de departamentos.
 *
 * @param contexto Dónde ocurrió, para localizarlo en el log (ej. "listEmpleados").
 */
export function friendlyError(err: unknown, contexto?: string): string {
  // Los errores de Supabase NO son `Error`: son objetos planos con `message`.
  // Sin este caso, `raw` quedaba vacío y ni se traducía el mensaje ni se
  // registraba nada útil — justo con los errores que más importa ver.
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : typeof (err as { message?: unknown })?.message === "string"
          ? ((err as { message: string }).message)
          : "";
  const text = raw.toLowerCase();

  // Solo en servidor: en el navegador ensuciaría la consola del usuario.
  if (typeof window === "undefined") {
    const donde = contexto ? `[${contexto}] ` : "";
    console.error(
      `${donde}${raw || "error sin mensaje"}${detalleSupabase(err)}`,
    );
  }

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

  // Supabase Auth — alta / gestión de usuarios
  if (
    text.includes("already been registered") ||
    text.includes("already registered") ||
    text.includes("user already exists") ||
    text.includes("email address is already")
  ) {
    return "Ya existe un usuario registrado con ese email. Si el empleado ya tiene cuenta, vincúlalo desde Ajustes → Usuarios.";
  }
  if (text.includes("password should be at least") || (text.includes("password") && text.includes("characters"))) {
    return "La contraseña es demasiado corta. Debe tener al menos 6 caracteres.";
  }
  if (text.includes("weak password")) {
    return "La contraseña es demasiado débil. Usa una más larga o con más variedad.";
  }
  if (text.includes("unable to validate email") || text.includes("invalid email") || text.includes("invalid format")) {
    return "El email no es válido. Revisa que esté bien escrito.";
  }
  if (text.includes("email rate limit") || text.includes("rate limit") || text.includes("too many requests")) {
    return "Demasiados intentos. Espera unos segundos antes de volver a intentarlo.";
  }
  if (text.includes("for security purposes") && text.includes("once every")) {
    return "Por seguridad, solo puedes intentar esto una vez por minuto. Espera y vuelve a intentarlo.";
  }
  if (text.includes("user not found")) {
    return "Usuario no encontrado.";
  }
  if (text.includes("invalid token") || text.includes("token has expired") || text.includes("expired token")) {
    return "El enlace ha caducado. Solicita uno nuevo.";
  }
  if (text.includes("email not confirmed")) {
    return "El email aún no está confirmado.";
  }
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
    return "El registro está desactivado. Contacta con un administrador.";
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

  // Si el mensaje original ya parece estar en español (acentos, ñ o palabras
  // funcionales habituales), lo respetamos: cubre los `throw new Error("…")`
  // del código de negocio (ej. "Sin permisos: …", "No autenticado").
  if (/[áéíóúñ¿¡]/i.test(raw) || /\b(no|sin|el|la|los|las|de|del|en|con|para|por|un|una|ya|que|se|es)\b/i.test(raw)) {
    return raw;
  }

  // Por defecto: mensaje neutro. Se añade el CONTEXTO entre paréntesis cuando lo
  // hay: "Ha ocurrido un error" a secas no distingue un fallo al crear el
  // usuario de uno al insertar el empleado, y obliga a reproducir el caso a mano
  // para saber cuál fue. Con la etiqueta, el mismo texto que ve el usuario sirve
  // para encontrar la traza exacta en el log del servidor.
  return contexto
    ? `Ha ocurrido un error. Inténtalo de nuevo. (${contexto})`
    : "Ha ocurrido un error. Inténtalo de nuevo.";
}
