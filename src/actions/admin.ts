'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capitalizeText } from '@/shared/lib/utils'
import { sendEmail } from '@/lib/email/send'
import { passwordResetEmail } from '@/lib/email/templates/password-reset'

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

/**
 * Verifica que el nombre de rol exista en empresa_roles para la empresa del usuario.
 * El dropdown de la UI solo muestra estos roles; esto es la defensa server-side.
 */
async function assertRoleExistsInEmpresa(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  rolLabel: string,
): Promise<{ error?: string }> {
  const { data, error } = await admin
    .from('empresa_roles')
    .select('nombre')
    .eq('empresa_id', empresaId)
    .ilike('nombre', rolLabel.trim())
    .limit(1)
    .maybeSingle()
  if (error) return { error: `Error validando rol: ${error.message}` }
  if (!data) return { error: `El rol "${rolLabel}" no existe en empresa_roles. Créalo primero en la pestaña Roles.` }
  return {}
}

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
  if (!rolLabelInput) return { error: 'Debes seleccionar un rol.' }

  // Validar que el rol exista en empresa_roles del invocador.
  const supabase = await createClient()
  const { data: { user: invoker } } = await supabase.auth.getUser()
  const { data: invokerProfile } = invoker
    ? await admin.from('profiles').select('empresa_id').eq('user_id', invoker.id).maybeSingle()
    : { data: null }
  const empresaId = invokerProfile?.empresa_id
  if (!empresaId) return { error: 'No se pudo determinar la empresa del invocador.' }
  const validation = await assertRoleExistsInEmpresa(admin, empresaId, rolLabelInput)
  if (validation.error) return { error: validation.error }

  const role: AppRole = inferAppRoleFromLabel(rolLabelInput)
  const rolLabel = rolLabelInput
  // El departamento ya no se asigna a nivel de usuario: se hereda del rol.
  const departamento = ((formData.get('departamento') as string) ?? '').trim().toUpperCase() || null

  // Crear usuario en auth (el trigger handle_new_user crea el profile automáticamente)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) return { error: error.message }

  // Completar nombre + (departamento opcional) + rol_label en el profile
  const profilePatch: Record<string, string | null> = {
    full_name: fullName,
    nombre,
    apellidos,
    rol_label: rolLabel,
  }
  if (departamento) profilePatch.departamento = departamento

  const { error: profileError } = await admin
    .from('profiles')
    .update(profilePatch)
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

/**
 * Envía un correo de recuperación de contraseña al usuario indicado.
 *
 * Flujo:
 *   1. Generamos un magic link de tipo "recovery" con admin.generateLink.
 *   2. Si RESEND_API_KEY + EMAIL_FROM están en .env, lo enviamos nosotros con
 *      Resend (gratis hasta 3.000 mails/mes, sin límite de 3/h).
 *   3. Si no, caemos al envío automático de Supabase (sandbox o el SMTP que
 *      tenga el proyecto), para no romper en entornos sin Resend configurado.
 *
 * El enlace lleva a /update-password donde el usuario define su nueva clave.
 */
export async function sendPasswordResetEmail(profileId: string) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('email, nombre, apellidos, full_name, empresa_id')
    .eq('id', profileId)
    .maybeSingle()

  if (pErr) return { error: pErr.message }
  if (!profile?.email) return { error: 'El usuario no tiene email asociado.' }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : null) ??
    'http://localhost:3000'
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/update-password`

  // 1) Generamos el magic link (no envía nada por sí mismo).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return { error: linkErr?.message ?? 'No se pudo generar el enlace de recuperación.' }
  }

  const actionUrl = linkData.properties.action_link
  const recipientName =
    [profile.nombre, profile.apellidos].filter(Boolean).join(' ').trim() ||
    profile.full_name ||
    undefined

  // 2) Intentamos enviar con Resend (configurado por el dueño del software).
  const { subject, html, text } = passwordResetEmail({
    recipientName,
    actionUrl,
  })

  const sendResult = await sendEmail({
    to: profile.email,
    subject,
    html,
    text,
    empresaId: profile.empresa_id ?? null,
  })

  if (sendResult.ok) {
    return { success: true, email: profile.email, transport: sendResult.transport }
  }

  // Si Resend devolvió error explícito, lo reportamos.
  if (sendResult.configured) {
    return { error: `No se pudo enviar el correo: ${sendResult.error}` }
  }

  // 3) Fallback: dejar que Supabase envíe el correo (sandbox / SMTP del proyecto).
  const { error: rErr } = await admin.auth.resetPasswordForEmail(profile.email, {
    redirectTo,
  })

  if (rErr) return { error: rErr.message }

  return { success: true, email: profile.email, transport: 'supabase' as const }
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
  // y derivamos el app_role para user_roles. Validamos contra empresa_roles para
  // evitar guardar roles inventados. Validamos primero contra la empresa del INVOCADOR
  // (que es la que alimenta el dropdown de la UI). Si el target pertenece a otra
  // empresa, intentamos también con la del target para mantener compatibilidad.
  if (patch.role !== undefined) {
    const trimmed = patch.role.trim()
    if (trimmed) {
      const supabase = await createClient()
      const { data: { user: invoker } } = await supabase.auth.getUser()
      const { data: invokerProfile } = invoker
        ? await admin.from('profiles').select('empresa_id').eq('user_id', invoker.id).maybeSingle()
        : { data: null }
      const { data: target } = await admin
        .from('profiles')
        .select('empresa_id')
        .eq('id', profileId)
        .maybeSingle()

      const empresasACheckear = [invokerProfile?.empresa_id, target?.empresa_id]
        .filter((id): id is string => Boolean(id))
      const empresasUnicas = Array.from(new Set(empresasACheckear))

      if (empresasUnicas.length === 0) {
        return { error: 'No se pudo determinar la empresa para validar el rol.' }
      }

      let rolEncontrado = false
      let ultimoError: string | undefined
      for (const empId of empresasUnicas) {
        const validation = await assertRoleExistsInEmpresa(admin, empId, trimmed)
        if (!validation.error) { rolEncontrado = true; break }
        ultimoError = validation.error
      }
      if (!rolEncontrado) return { error: ultimoError ?? `El rol "${trimmed}" no existe.` }
    }
    profileUpdate.rol_label = trimmed || null
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
  const invoker = await requireAdmin()

  if (invoker.id === userId) {
    return { error: 'No puedes borrar tu propio usuario.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/empleados')
  revalidatePath('/ajustes')
  return { success: true }
}
