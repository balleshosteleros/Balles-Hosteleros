'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')

  return user
}

export async function createEmployee(formData: FormData) {
  await requireAdmin()

  const admin = createAdminClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as string

  // Crear usuario en auth
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) return { error: error.message }

  // Actualizar rol en profiles
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role, full_name: fullName })
    .eq('id', data.user.id)

  if (profileError) return { error: profileError.message }

  revalidatePath('/admin/empleados')
  return { success: true }
}

export async function getEmployees() {
  await requireAdmin()

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message, data: [] }

  return { data: data ?? [] }
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
