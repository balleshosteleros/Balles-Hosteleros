import type { SupabaseClient } from '@supabase/supabase-js'

export type ProfileGuardCode =
  | 'sin_perfil'
  | 'cuenta_inactiva'
  | 'sin_empresa'
  | 'sin_rol'

export type ProfileGuardResult =
  | { ok: true; empresaId: string; rolLabel: string }
  | { ok: false; code: ProfileGuardCode }

/**
 * Verifica que un user autenticado tenga perfil completo y activo:
 * existe en profiles, estado_acceso = Activo, tiene empresa y rol.
 * Cualquier fallo aquí significa que NO debe quedarse con sesión válida.
 */
export async function checkProfileGuard(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileGuardResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('estado_acceso, empresa_id, rol_label')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return { ok: false, code: 'sin_perfil' }

  const estado = (profile.estado_acceso as string | null) ?? null
  if (estado && estado !== 'Activo') {
    return { ok: false, code: 'cuenta_inactiva' }
  }

  const empresaId = (profile.empresa_id as string | null) ?? null
  if (!empresaId) return { ok: false, code: 'sin_empresa' }

  const rolLabel = (profile.rol_label as string | null) ?? null
  if (!rolLabel) return { ok: false, code: 'sin_rol' }

  return { ok: true, empresaId, rolLabel }
}

const GENERIC_ACCESS_MESSAGE = 'Usuario o contraseña incorrectos.'

export const PROFILE_GUARD_MESSAGES: Record<ProfileGuardCode, string> = {
  sin_perfil: GENERIC_ACCESS_MESSAGE,
  cuenta_inactiva: GENERIC_ACCESS_MESSAGE,
  sin_empresa: GENERIC_ACCESS_MESSAGE,
  sin_rol: GENERIC_ACCESS_MESSAGE,
}
