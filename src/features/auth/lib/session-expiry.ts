// Caducidad ABSOLUTA de sesión en ordenador (desktop).
//
// Requisito: en ordenador la sesión debe cerrarse automáticamente a las 8 horas
// del inicio de sesión y obligar a volver a hacer login — aunque el usuario siga
// trabajando (caducidad absoluta, no por inactividad).
//
// Supabase por sí solo NUNCA caduca la sesión: el proxy refresca el token en cada
// request, así que el enforcement lo hacemos nosotros. Sembramos una cookie con
// el instante del login y el proxy la compara contra el reloj del servidor.
//
// El móvil/PWA (rutas /m, o user-agent móvil) queda EXENTO: mantiene la sesión
// como hasta ahora.

/** Duración máxima de una sesión de ordenador, en milisegundos (8 horas). */
export const SESION_MAX_MS = 8 * 60 * 60 * 1000

/** Cookie que guarda el timestamp (ms epoch) del inicio de sesión. */
export const SESION_INICIO_COOKIE = 'bh_sesion_inicio'

/** Code de error con el que redirigimos al login cuando caduca la sesión. */
export const SESION_EXPIRADA_CODE = 'sesion_expirada'

// User-agents móviles: mismo criterio que el redirect edge de next.config.ts.
// En esos dispositivos NO aplicamos la caducidad de 8h.
const MOBILE_UA_REGEX =
  /(iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone)/i

/**
 * ¿Es un dispositivo móvil? Combina dos señales: el user-agent y la ruta /m
 * (la app móvil/PWA vive bajo /m). Cualquiera de las dos lo marca como móvil.
 */
export function esDispositivoMovil(userAgent: string | null, pathname: string): boolean {
  if (pathname === '/m' || pathname.startsWith('/m/')) return true
  return !!userAgent && MOBILE_UA_REGEX.test(userAgent)
}

/**
 * ¿Ha caducado la sesión de ordenador? Recibe el valor crudo de la cookie de
 * inicio y el "ahora" en ms. Si la cookie no es un número válido, NO se considera
 * caducada aquí: el proxy se encarga de (re)sembrarla.
 */
export function sesionCaducada(inicioCookie: string | undefined, ahoraMs: number): boolean {
  if (!inicioCookie) return false
  const inicio = Number(inicioCookie)
  if (!Number.isFinite(inicio) || inicio <= 0) return false
  return ahoraMs - inicio >= SESION_MAX_MS
}
