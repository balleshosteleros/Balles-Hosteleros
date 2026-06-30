/**
 * Landing por ROL tras un login válido (no por puesto):
 *   - Rol dirección (director/admin) → /mis-departamentos (cuadrícula de
 *     departamentos del grupo).
 *   - Resto de roles → /mi-panel (su panel personal por defecto).
 *
 * La decisión se toma en el servidor (callback de login) leyendo getRolContext,
 * para que cada usuario aterrice directo en su página, sin parpadeo ni rebote
 * en cliente.
 *
 * IMPORTANTE: solo redirigir tras pasar checkProfileGuard.
 */
export const LANDING_DIRECCION = '/mis-departamentos'
export const LANDING_RESTO = '/mi-panel'

/** Default histórico (fallback). Equivale al landing de dirección. */
export const LANDING_PATH = LANDING_DIRECCION

export function landingPorRol(esDirector: boolean): string {
  return esDirector ? LANDING_DIRECCION : LANDING_RESTO
}

/**
 * @deprecated Usar landingPorRol(esDirector). Passthrough para imports antiguos.
 */
export function getRedirectByRolLabel(
  _rolLabel: string | null | undefined,
): string {
  return LANDING_PATH
}
