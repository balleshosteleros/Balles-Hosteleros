import type { SupabaseClient } from '@supabase/supabase-js'

export type ProfileGuardCode =
  | 'sin_perfil'
  | 'cuenta_inactiva'
  | 'sin_empresa'
  | 'sin_rol'
  | 'sin_password'

export type ProfileGuardResult =
  | { ok: true; empresaId: string; rolLabel: string }
  | { ok: false; code: ProfileGuardCode }

/**
 * Verifica que un user autenticado tenga perfil completo y activo:
 * existe en profiles, estado_acceso = Activo, tiene empresa, rol y ha
 * ELEGIDO su propia contraseña (password_set). Cualquier fallo aquí
 * significa que NO debe quedarse con sesión válida.
 */
export async function checkProfileGuard(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileGuardResult> {
  const { data: profile } = await supabase
    .from('usuarios')
    .select('estado_acceso, empresa_id, rol_id, rol_label, password_set')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return { ok: false, code: 'sin_perfil' }

  const estado = (profile.estado_acceso as string | null) ?? null
  if (estado && estado !== 'Activo') {
    return { ok: false, code: 'cuenta_inactiva' }
  }

  const empresaId = (profile.empresa_id as string | null) ?? null
  if (!empresaId) return { ok: false, code: 'sin_empresa' }

  // Fuente única (PRP-063): el rol se valida por rol_id; rol_label es un espejo.
  // Fallback defensivo a rol_label para no regresar a usuarios en transición.
  const rolId = (profile.rol_id as string | null) ?? null
  const rolLabel = (profile.rol_label as string | null) ?? null
  if (!rolId && !rolLabel) return { ok: false, code: 'sin_rol' }

  // El empleado debe haber elegido SU contraseña (vía el correo "Crea tu
  // contraseña"). Mientras no lo haya hecho, no entra ni con Google: la
  // contraseña aleatoria del alta no la conoce, y la necesita para acciones
  // de seguridad (ver contraseñas guardadas).
  if (profile.password_set === false) return { ok: false, code: 'sin_password' }

  return { ok: true, empresaId, rolLabel: rolLabel ?? '' }
}

const GENERIC_ACCESS_MESSAGE = 'Usuario o contraseña incorrectos.'

// Único mensaje específico: cuando la cuenta existe pero falta elegir
// contraseña, guiamos al empleado en lugar de ocultarlo como credencial mala.
const SIN_PASSWORD_MESSAGE =
  'Tienes una cuenta, pero primero debes elegir tu contraseña. Revisa el correo "Crea tu contraseña" que te enviamos.'

export const PROFILE_GUARD_MESSAGES: Record<ProfileGuardCode, string> = {
  sin_perfil: GENERIC_ACCESS_MESSAGE,
  cuenta_inactiva: GENERIC_ACCESS_MESSAGE,
  sin_empresa: GENERIC_ACCESS_MESSAGE,
  sin_rol: GENERIC_ACCESS_MESSAGE,
  sin_password: SIN_PASSWORD_MESSAGE,
}
