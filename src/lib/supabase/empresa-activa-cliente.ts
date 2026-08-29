/**
 * Empresa activa en el NAVEGADOR, para que el cliente de Supabase la mande en
 * la cabecera `x-bh-empresa` y la RLS aísle de verdad.
 *
 * La cookie `bh_empresa_activa` es HttpOnly (no se puede leer desde JS, y así
 * debe seguir siendo), de modo que el navegador guarda aquí su propia copia.
 * Es solo una PISTA de qué está mirando el usuario: quién puede ver qué lo
 * decide siempre la base de datos, que comprueba que la empresa declarada sea
 * realmente del usuario antes de autorizar nada.
 */

const KEY = "bh_empresa_activa_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Empresa activa conocida por esta pestaña (UUID) o `null`. */
export function getEmpresaActivaCliente(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && UUID_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Guarda la empresa activa al cambiar de empresa (y al arrancar la sesión). */
export function setEmpresaActivaCliente(empresaId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (empresaId && UUID_RE.test(empresaId)) {
      window.localStorage.setItem(KEY, empresaId);
    } else {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    // Modo privado o almacenamiento bloqueado: sin copia local, el servidor
    // sigue mandando la cabecera correcta desde la cookie.
  }
}
