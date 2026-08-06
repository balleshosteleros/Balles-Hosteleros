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
 * existe en profiles, estado_acceso = Activo, tiene empresa y rol.
 * Cualquier fallo aquí significa que NO debe quedarse con sesión válida.
 *
 * `exigirPassword` (decisión de Ivan, 2026-08-06): la contraseña propia SOLO
 * se exige en el login por correo+contraseña. Quien entra con Google nunca
 * escribe una, así que exigírsela lo dejaba en bucle: el sistema le pedía una
 * contraseña que su forma de entrar no le iba a pedir jamás. La barrera vivía
 * en la puerta cuando en realidad solo hace falta dentro, en el módulo seguro
 * de contraseñas guardadas — que debe pedirla en ese momento, no aquí.
 */
export async function checkProfileGuard(
  supabase: SupabaseClient,
  userId: string,
  { exigirPassword = false }: { exigirPassword?: boolean } = {},
): Promise<ProfileGuardResult> {
  const { data: profile } = await supabase
    .from('usuarios')
    .select('estado_acceso, empresa_id, rol_id, rol_label, password_set')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return { ok: false, code: 'sin_perfil' }

  // Solo entra quien está explícitamente 'Activo'. Antes era `if (estado && …)`,
  // que dejaba pasar a quien NO tuviera estado (null o vacío): la condición se
  // saltaba entera y el usuario colaba sin que nadie le hubiera dado el alta.
  // Sin estado NO se entra — sin estado no hay permiso, y la ausencia de dato
  // nunca puede valer como permiso concedido.
  const estado = (profile.estado_acceso as string | null)?.trim() || null
  if (estado !== 'Activo') {
    return { ok: false, code: 'cuenta_inactiva' }
  }

  const empresaId = (profile.empresa_id as string | null) ?? null
  if (!empresaId) return { ok: false, code: 'sin_empresa' }

  // Fuente única (PRP-063): el rol se valida por rol_id; rol_label es un espejo.
  // Fallback defensivo a rol_label para no regresar a usuarios en transición.
  const rolId = (profile.rol_id as string | null) ?? null
  const rolLabel = (profile.rol_label as string | null) ?? null
  if (!rolId && !rolLabel) return { ok: false, code: 'sin_rol' }

  // Solo en el login por correo+contraseña: si el empleado aún no ha estrenado
  // SU contraseña (correo "Crea tu contraseña"), la que escribe no puede ser la
  // suya — la del alta es aleatoria y no la conoce. Por Google no aplica.
  if (exigirPassword && profile.password_set === false) {
    return { ok: false, code: 'sin_password' }
  }

  return { ok: true, empresaId, rolLabel: rolLabel ?? '' }
}

// Mensaje ÚNICO de acceso denegado (decisión de Ivan, 2026-08-05): idéntico
// tanto por usuario/contraseña como por Google. Debe coincidir con el de
// LoginForm.tsx y con el que lanza el trigger handle_new_user en la BD.
const GENERIC_ACCESS_MESSAGE = 'Esta cuenta no tiene acceso al sistema.'

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
