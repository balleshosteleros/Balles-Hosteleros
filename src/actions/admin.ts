'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capitalizeText } from '@/shared/lib/utils'

const VALID_ROLES = ['admin', 'director', 'gerencia', 'responsable', 'empleado', 'solo_lectura'] as const
type AppRole = typeof VALID_ROLES[number]

function normalizeRole(input: string | null | undefined): AppRole {
  const r = (input ?? '').toLowerCase().replace(/\s+/g, '_')
  return (VALID_ROLES as readonly string[]).includes(r) ? (r as AppRole) : 'empleado'
}

const ADMIN_ROLES = ['admin', 'director'] as const

async function requireAdmin() {
  // En modo dev bypass, permitir acceso sin autenticación real
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true') {
    return { id: 'dev-bypass', email: 'dev@local' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  const hasAccess = (roles ?? []).some((r: { role: string }) =>
    (ADMIN_ROLES as readonly string[]).includes(r.role)
  )
  if (!hasAccess) throw new Error('Not authorized')

  return user
}

export async function createEmployee(formData: FormData) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nombre = capitalizeText((formData.get('nombre') as string) ?? '')
  const apellidos = capitalizeText((formData.get('apellidos') as string) ?? '')
  const fullName = [nombre, apellidos].filter(Boolean).join(' ')
  const role = normalizeRole(formData.get('role') as string)

  // Crear usuario en auth (el trigger handle_new_user crea el profile automáticamente)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) return { error: error.message }

  // Completar nombre en el profile
  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: fullName, nombre, apellidos })
    .eq('id', data.user.id)

  if (profileError) return { error: profileError.message }

  // Asignar rol en user_roles
  const { error: roleError } = await admin
    .from('user_roles')
    .insert({ user_id: data.user.id, role })

  if (roleError) return { error: roleError.message }

  revalidatePath('/admin/empleados')
  revalidatePath('/ajustes')
  return { success: true }
}

export async function getEmployees() {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    // Sin Supabase admin configurado (dev bypass): devolver lista vacía
    return { data: [] }
  }

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }

  const { data: roles } = await admin
    .from('user_roles')
    .select('user_id, role')

  const rolesByUser = new Map<string, string>()
  ;(roles ?? []).forEach((r: { user_id: string; role: string }) => {
    // Si el usuario tiene varios roles, dejamos el de mayor jerarquía (admin > director > ...)
    const order = ['admin', 'director', 'gerencia', 'responsable', 'empleado', 'solo_lectura']
    const current = rolesByUser.get(r.user_id)
    if (!current || order.indexOf(r.role) < order.indexOf(current)) {
      rolesByUser.set(r.user_id, r.role)
    }
  })

  const data = (profiles ?? []).map((p: { id: string; user_id?: string | null }) => ({
    ...p,
    role: rolesByUser.get(p.user_id ?? p.id) ?? 'empleado',
  }))

  return { data }
}

export async function resetEmployeePassword(userId: string, newPassword: string) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })

  if (error) return { error: error.message }

  return { success: true }
}

export async function updateEmployeeStatus(profileId: string, estado: 'Activo' | 'Inactivo' | 'Pendiente') {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ estado_acceso: estado })
    .eq('id', profileId)

  if (error) return { error: error.message }

  revalidatePath('/ajustes')
  return { success: true }
}

export async function getEmpleadosSinAcceso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data: profile } = await supabase
    .from('profiles')
    .select('empresa_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.empresa_id) return { data: [] }

  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre, apellidos, email_personal, email_empresa, departamentos(nombre)')
    .eq('empresa_id', profile.empresa_id)
    .eq('estado', 'Activo')
    .is('profile_id', null)
    .order('nombre')

  if (error) return { error: error.message, data: [] }
  return { data: data ?? [] }
}

export async function deleteEmployee(userId: string) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/empleados')
  return { success: true }
}
