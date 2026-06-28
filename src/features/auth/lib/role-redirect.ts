/**
 * Tras login válido, todo usuario aterriza en /mis-departamentos. Allí, la vista
 * MisDepartamentosView aplica la regla por rol:
 *   - Rol dirección (director/admin) → permanece en Mis Departamentos (cuadrícula
 *     de departamentos, con el botón DIRECCIÓN visible).
 *   - Resto de roles → se redirigen a /mi-panel (su landing por defecto).
 *
 * IMPORTANTE: solo redirigir aquí cuando el profile haya pasado checkProfileGuard.
 * Si el caller no valida, hay que llamar a checkProfileGuard antes.
 */
export const LANDING_PATH = '/mis-departamentos'

/**
 * @deprecated Usar LANDING_PATH directamente y validar profile con checkProfileGuard.
 * Se mantiene como passthrough para no romper imports existentes.
 */
export function getRedirectByRolLabel(
  _rolLabel: string | null | undefined,
): string {
  return LANDING_PATH
}
