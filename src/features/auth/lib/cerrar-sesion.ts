/**
 * Utilidades de CIERRE DE SESIÓN, sin dependencias.
 *
 * Viven en su propio módulo (y no en `auth-context.tsx`) porque aquel importa
 * `permisos-actions` —un fichero `"use server"`— y arrastrarlo desde un componente
 * de móvil metía toda esa cadena en el bundle del cliente. Este módulo es TypeScript
 * puro: no importa nada, así que no puede romper nada al cargarse.
 *
 * Reportado por Iván (05-ago): "cerrar sesión se queda pillado y no hace nada".
 */

/**
 * Resuelve como muy tarde en `ms`, pase lo que pase con la promesa original.
 * Ninguna limpieza puede dejar al usuario atrapado dentro de la app si la red va mal.
 */
export function conTopeDeTiempo<T>(p: Promise<T>, ms = 3000): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null);
}

/**
 * Borra a mano las cookies de sesión de Supabase (`sb-*`) desde el navegador.
 *
 * Red de seguridad: si `signOut()` falla o tarda y tampoco llega la respuesta del
 * servidor, la cookie sobreviviría y el usuario volvería a entrar con la sesión
 * viva. Se prueban varias rutas y dominios porque el navegador solo elimina la
 * cookie si coinciden exactamente con los que se usaron al crearla.
 *
 * Cubre el token partido en trozos (`sb-<ref>-auth-token.0`, `.1`…), habitual
 * cuando el JWT es largo: borrar solo la cookie base dejaría la sesión viva.
 */
export function borrarCookiesSesion(): void {
  if (typeof document === "undefined") return;

  const host = window.location.hostname;
  const partes = host.split(".");
  const dominios: Array<string | undefined> = [
    undefined,
    host,
    partes.length > 2 ? `.${partes.slice(-2).join(".")}` : undefined,
  ];

  for (const cookie of document.cookie.split(";")) {
    const nombre = cookie.split("=")[0]?.trim();
    if (!nombre || !nombre.startsWith("sb-")) continue;
    for (const dominio of dominios) {
      document.cookie =
        `${nombre}=; path=/; max-age=0; samesite=lax` +
        (dominio ? `; domain=${dominio}` : "");
    }
  }
}

/**
 * Borra también el almacenamiento local del navegador.
 *
 * En una PWA instalada (que es como Iván usa la app) Supabase puede guardar la
 * sesión en `localStorage` además de en la cookie. Si solo se borra la cookie, la
 * librería la restaura desde ahí en el siguiente arranque y el usuario sigue
 * dentro — exactamente lo que reportó Iván tras el primer arreglo.
 */
export function borrarSesionLocal(): void {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const aBorrar: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        // `sb-*` = sesión de Supabase · `bh_*` = cachés de perfil y permisos.
        if (k && (k.startsWith("sb-") || k.startsWith("bh_"))) aBorrar.push(k);
      }
      aBorrar.forEach((k) => store.removeItem(k));
    } catch {
      // Modo privado o cuota: no puede impedir el cierre de sesión.
    }
  }
}
