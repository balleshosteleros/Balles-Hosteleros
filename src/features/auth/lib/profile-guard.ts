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

export const PROFILE_GUARD_MESSAGES: Record<ProfileGuardCode, string> = {
  sin_perfil:
    'Tu cuenta no está dada de alta en el sistema. Contacta con el administrador.',
  cuenta_inactiva:
    'Tu cuenta está inactiva. Contacta con el administrador del sistema.',
  sin_empresa:
    'Tu cuenta no tiene empresa asignada. Contacta con el administrador.',
  sin_rol:
    'Tu cuenta no tiene un rol asignado. Contacta con el administrador.',
}
