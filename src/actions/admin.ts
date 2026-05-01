'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capitalizeText } from '@/shared/lib/utils'

const VALID_ROLES = ['admin', 'director', 'gerencia', 'responsable', 'empleado', 'solo_lectura'] as const
type AppRole = typeof VALID_ROLES[number]

/**
 * Mapea un nombre de rol custom (de empresa_roles, ej "Jefe Cocina", "Contable")
 * al app_role RBAC más cercano para autorización en user_roles.
 * El nombre original se guarda en profiles.rol_label.
 */
function inferAppRoleFromLabel(label: string | null | undefined): AppRole {
  const n = (label ?? '').toLowerCase().trim()
  if (!n) return 'empleado'
  if (n.includes('admin')) return 'admin'
  if (n.includes('director') || n.includes('direcci')) return 'director'
  if (n.includes('gerencia') || n.includes('gerente')) return 'gerencia'
  if (n.includes('responsable') || n.includes('jefe') || n.includes('encargad')) return 'responsable'
  if (n.includes('solo lectura') || n === 'lectura') return 'solo_lectura'
  // Si el label coincide directamente con un app_role (caso retrocompatible)
  if ((VALID_ROLES as readonly string[]).includes(n)) return n as AppRole
  return 'empleado'
}

const ADMIN_ROLES = ['admin', 'director'] as const

async function requireAdmin() {
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
  // El campo "role" del form ahora contiene el NOMBRE del rol custom (ej "Jefe Cocina").
  // Lo guardamos tal cual en profiles.rol_label, e inferimos el app_role para user_roles.
  const rolLabelInput = ((formData.get('role') as string) ?? '').trim()
  const role: AppRole = rolLabelInput ? inferAppRoleFromLabel(rolLabelInput) : 'empleado'
  const rolLabel = rolLabelInput || null
  const departamento = ((formData.get('departamento') as string) ?? '').trim().toUpperCase()

  if (!departamento) {
    return { error: 'El departamento es obligatorio.' }
  }

  // Crear usuario en auth (el trigger handle_new_user crea el profile automáticamente)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) return { error: error.message }

  // Completar nombre + departamento + rol_label en el profile
  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: fullName, nombre, apellidos, departamento, rol_label: rolLabel })
    .eq('id', data.user.id)

  if (profileError) return { error: profileError.message }

  // Asignar rol RBAC en user_roles (para autorización)
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

  const data = (profiles ?? []).map((p: { id: string; user_id?: string | null; rol_label?: string | null }) => ({
    ...p,
    role: rolesByUser.get(p.user_id ?? p.id) ?? 'empleado',
    // rol_label = nombre custom del rol (preferente para mostrar en UI)
    rol_label: p.rol_label ?? null,
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

export async function updateEmployeeProfile(
  profileId: string,
  patch: { departamento?: string; role?: string; nombre?: string; apellidos?: string }
) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const profileUpdate: Record<string, string | null> = {}
  if (patch.departamento !== undefined) {
    const dep = patch.departamento.trim().toUpperCase()
    if (!dep) return { error: 'El departamento no puede estar vacío.' }
    profileUpdate.departamento = dep
  }
  if (patch.nombre !== undefined) profileUpdate.nombre = capitalizeText(patch.nombre)
  if (patch.apellidos !== undefined) profileUpdate.apellidos = capitalizeText(patch.apellidos)

  // El rol que llega es el NOMBRE custom (de empresa_roles). Lo guardamos en rol_label
  // y derivamos el app_role para user_roles.
  if (patch.role !== undefined) {
    profileUpdate.rol_label = patch.role.trim() || null
  }

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', profileId)
    if (error) return { error: error.message }
  }

  // Actualizar app_role en user_roles si se pidió
  if (patch.role !== undefined) {
    const role = inferAppRoleFromLabel(patch.role)
    const { data: profile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('id', profileId)
      .maybeSingle()
    const userId = profile?.user_id
    if (userId) {
      await admin.from('user_roles').delete().eq('user_id', userId)
      const { error } = await admin.from('user_roles').insert({ user_id: userId, role })
      if (error) return { error: error.message }
    }
  }

  revalidatePath('/ajustes')
  return { success: true }
}

export async function getDepartamentosDisponibles(): Promise<{
  data: string[]
  error?: string
}> {
  try {
    const admin = createAdminClient()
    // Recoge los rol distintos de cronogramas_operativos como lista canónica
    const { data, error } = await admin
      .from('cronogramas_operativos')
      .select('rol')
      .not('rol', 'is', null)
    if (error) return { data: [], error: error.message }
    const set = new Set<string>()
    for (const row of data ?? []) {
      const r = (row as { rol: string | null }).rol
      if (r && r.trim()) set.add(r.trim().toUpperCase())
    }
    return { data: Array.from(set).sort() }
  } catch {
    // Fallback razonable si admin no está disponible
    return {
      data: [
        'DIRECCION', 'SALA', 'COCINA', 'CALIDAD', 'RECURSOS HUMANOS',
        'MARKETING', 'LOGISTICA', 'CONTABILIDAD', 'GESTORIA', 'JURIDICO', 'GERENCIA',
      ],
    }
  }
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
