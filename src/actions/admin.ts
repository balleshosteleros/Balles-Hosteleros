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

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)

  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin')
  if (!isAdmin) throw new Error('Not authorized')

  return user
}

export async function createEmployee(formData: FormData) {
  await requireAdmin()

  const admin = createAdminClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = capitalizeText((formData.get('full_name') as string) ?? '')
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
    .update({ full_name: fullName, nombre: fullName })
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

  const admin = createAdminClient()

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

  const admin = createAdminClient()

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })

  if (error) return { error: error.message }

  return { success: true }
}

export async function deleteEmployee(userId: string) {
  await requireAdmin()

  const admin = createAdminClient()

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/empleados')
  return { success: true }
}
