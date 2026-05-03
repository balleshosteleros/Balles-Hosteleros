'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { testSmtpDirect } from '@/lib/email/send'

const ADMIN_ROLES = ['admin', 'director'] as const

export type EmpresaEmailConfig = {
  empresaId: string
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  /** Nunca se devuelve al cliente. Se reemplaza por '' o por un placeholder. */
  smtp_password: string
  from_email: string
  from_name: string | null
  enabled: boolean
  last_test_at: string | null
  last_test_ok: boolean | null
  last_test_error: string | null
}

export type EmpresaEmailConfigInput = {
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  /** Si viene vacío en una actualización, se conserva el valor actual. */
  smtp_password: string
  from_email: string
  from_name: string | null
  enabled: boolean
}

/**
 * Marca de oscurecido que devolvemos en lugar del password real.
 * El cliente puede mostrarla y, si el admin no la cambia, la mandará tal cual
 * en saveEmpresaEmailConfig — el server detecta el sentinel y conserva la clave.
 */
const PASSWORD_MASK = '__keep__'

async function requireAdminOfEmpresa(empresaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // Multi-empresa: el acceso vive en user_empresas, no en profiles.empresa_id
  // (ese campo es solo la empresa "primaria" y el usuario puede ser director en varias).
  const { data: acceso } = await supabase
    .from('user_empresas')
    .select('empresa_id')
    .eq('user_id', user.id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!acceso) {
    // Fallback: admins legacy que solo tienen profiles.empresa_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile || profile.empresa_id !== empresaId) {
      throw new Error('No tienes permisos sobre esta empresa.')
    }
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
  const ok = (roles ?? []).some((r: { role: string }) =>
    (ADMIN_ROLES as readonly string[]).includes(r.role)
  )
  if (!ok) throw new Error('Solo admin/director pueden cambiar la configuración de correo.')

  return user
}

export async function getEmpresaEmailConfig(empresaId: string): Promise<{
  data?: EmpresaEmailConfig
  error?: string
}> {
  try {
    await requireAdminOfEmpresa(empresaId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error de autorización' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado.' }
  }

  const { data, error } = await admin
    .from('empresa_email_config')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { data: undefined }

  return {
    data: {
      empresaId,
      smtp_host: data.smtp_host,
      smtp_port: data.smtp_port,
      smtp_secure: data.smtp_secure,
      smtp_user: data.smtp_user,
      // Nunca devolvemos el password real
      smtp_password: PASSWORD_MASK,
      from_email: data.from_email,
      from_name: data.from_name,
      enabled: data.enabled,
      last_test_at: data.last_test_at,
      last_test_ok: data.last_test_ok,
      last_test_error: data.last_test_error,
    },
  }
}

export async function saveEmpresaEmailConfig(
  empresaId: string,
  input: EmpresaEmailConfigInput,
): Promise<{ success?: true; error?: string }> {
  try {
    await requireAdminOfEmpresa(empresaId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error de autorización' }
  }

  if (!input.smtp_host?.trim() || !input.smtp_user?.trim() || !input.from_email?.trim()) {
    return { error: 'Faltan campos obligatorios (host, usuario, remitente).' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado.' }
  }

  // Si el password viene como sentinel, conservar el actual
  let finalPassword = input.smtp_password
  if (finalPassword === PASSWORD_MASK || finalPassword === '') {
    const { data: existing } = await admin
      .from('empresa_email_config')
      .select('smtp_password')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!existing) {
      return { error: 'Debes introducir la contraseña SMTP al crear la configuración.' }
    }
    finalPassword = existing.smtp_password
  }

  const payload = {
    empresa_id: empresaId,
    smtp_host: input.smtp_host.trim(),
    smtp_port: Number(input.smtp_port) || 587,
    smtp_secure: !!input.smtp_secure,
    smtp_user: input.smtp_user.trim(),
    smtp_password: finalPassword,
    from_email: input.from_email.trim(),
    from_name: input.from_name?.trim() || null,
    enabled: !!input.enabled,
  }

  const { error } = await admin
    .from('empresa_email_config')
    .upsert(payload, { onConflict: 'empresa_id' })

  if (error) return { error: error.message }

  revalidatePath('/ajustes')
  return { success: true }
}

export async function deleteEmpresaEmailConfig(
  empresaId: string,
): Promise<{ success?: true; error?: string }> {
  try {
    await requireAdminOfEmpresa(empresaId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error de autorización' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado.' }
  }

  const { error } = await admin
    .from('empresa_email_config')
    .delete()
    .eq('empresa_id', empresaId)

  if (error) return { error: error.message }

  revalidatePath('/ajustes')
  return { success: true }
}

/**
 * Prueba la configuración. Si `password === PASSWORD_MASK` recupera la actual
 * de BD; si no, usa la que viene en el input (útil al primer guardado).
 */
export async function testEmpresaEmailConfig(
  empresaId: string,
  input: EmpresaEmailConfigInput,
  to: string,
): Promise<{ success?: true; error?: string }> {
  try {
    await requireAdminOfEmpresa(empresaId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error de autorización' }
  }

  if (!to?.trim()) return { error: 'Falta el destinatario de prueba.' }

  let password = input.smtp_password
  if (password === PASSWORD_MASK || !password) {
    let admin: ReturnType<typeof createAdminClient>
    try {
      admin = createAdminClient()
    } catch {
      return { error: 'Supabase admin no configurado.' }
    }
    const { data: existing } = await admin
      .from('empresa_email_config')
      .select('smtp_password')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!existing) {
      return { error: 'Introduce la contraseña SMTP antes de probar.' }
    }
    password = existing.smtp_password
  }

  const result = await testSmtpDirect({
    smtp_host: input.smtp_host.trim(),
    smtp_port: Number(input.smtp_port) || 587,
    smtp_secure: !!input.smtp_secure,
    smtp_user: input.smtp_user.trim(),
    smtp_password: password,
    from_email: input.from_email.trim(),
    from_name: input.from_name?.trim() || null,
    to: to.trim(),
  })

  // Guardamos el resultado de la última prueba si la config existe
  try {
    const admin = createAdminClient()
    await admin
      .from('empresa_email_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: result.ok,
        last_test_error: result.ok ? null : result.error,
      })
      .eq('empresa_id', empresaId)
  } catch {
    // sin BD admin no podemos persistir el log de la prueba; ignorar
  }

  if (!result.ok) return { error: result.error }
  return { success: true }
}
