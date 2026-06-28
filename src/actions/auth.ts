'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LANDING_PATH } from '@/features/auth/lib/role-redirect'
import {
  checkProfileGuard,
  PROFILE_GUARD_MESSAGES,
} from '@/features/auth/lib/profile-guard'

function translateAuthError(message: string | undefined): string {
  if (!message) return 'No se pudo iniciar sesión.'
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Usuario o contraseña incorrectos.'
  }
  if (m.includes('email not confirmed')) {
    return 'El correo aún no ha sido confirmado.'
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Demasiados intentos. Inténtalo de nuevo en unos minutos.'
  }
  if (m.includes('user not found')) {
    return 'Usuario o contraseña incorrectos.'
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'No hay conexión con el servidor. Inténtalo de nuevo.'
  }
  return 'No se pudo iniciar sesión.'
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error || !data.user) {
    return { error: translateAuthError(error?.message) }
  }

  const guard = await checkProfileGuard(supabase, data.user.id)
  if (!guard.ok) {
    await supabase.auth.signOut()
    return { error: PROFILE_GUARD_MESSAGES[guard.code] }
  }

  revalidatePath('/', 'layout')
  redirect(LANDING_PATH)
}

export async function loginAsDemo(_formData: FormData) {
  const email = process.env.DEMO_EMAIL
  const password = process.env.DEMO_PASSWORD

  if (!email || !password) {
    return {
      error: 'El modo demo no está configurado. Contacta con el administrador.',
    }
  }

  // El demo solo está disponible en el host demo. Sin esta comprobación,
  // cualquiera podría llamar la server action desde el host principal y
  // entrar con la cuenta demo escribiendo un email cualquiera.
  const h = await headers()
  const rawHost =
    h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const normalizedHost = rawHost.toLowerCase().split(':')[0]
  const isDemoHost =
    normalizedHost === 'demo.balleshosteleros.com' ||
    normalizedHost.startsWith('demo.')

  if (!isDemoHost) {
    return {
      error: 'El acceso demo solo está disponible en demo.balleshosteleros.com.',
    }
  }

  const supabase = await createClient()

  // Limpia cualquier sesión previa (local) antes de entrar al demo
  // para que cada visitante empiece con una pizarra en blanco.
  await supabase.auth.signOut({ scope: 'local' })

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'No se pudo acceder al demo. Inténtalo de nuevo en unos minutos.' }
  }

  revalidatePath('/', 'layout')
  redirect('/mi-panel')
}

export async function signout() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const isDemo = !!(user?.email && process.env.DEMO_EMAIL && user.email === process.env.DEMO_EMAIL)

  await supabase.auth.signOut(isDemo ? { scope: 'local' } : undefined)

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  // URL base: preferimos NEXT_PUBLIC_APP_URL (la que está en .env.local), con
  // fallback a SITE_URL / VERCEL_URL / localhost. Sin esto, si SITE_URL no está
  // definida el link salía como "undefined/update-password".
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : null) ??
    'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl.replace(/\/$/, '')}/update-password`,
  })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  const { data: { user: userBefore } } = await supabase.auth.getUser()
  if (!userBefore) {
    return { error: 'Sesión no disponible.' }
  }

  // ¿Es el ALTA INICIAL (estrenar contraseña) o una RECUPERACIÓN normal?
  // El alta parte de password_set=false; la recuperación, de true. El enlace
  // del correo de bienvenida solo sirve para el alta: una vez asignada la
  // contraseña, no se puede volver a cambiar por esa vía (sí por "olvidé
  // contraseña", que genera un correo nuevo).
  const { data: perfilPrevio } = await supabase
    .from('usuarios')
    .select('password_set')
    .eq('user_id', userBefore.id)
    .maybeSingle()
  const esAltaInicial = perfilPrevio?.password_set === false

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Sesión no disponible.' }
  }

  if (esAltaInicial) {
    // El usuario acaba de estrenar SU contraseña → marca password_set.
    // Esto desbloquea el login (incluido Google), vetado mientras sea false.
    await supabase
      .from('usuarios')
      .update({ password_set: true })
      .eq('user_id', user.id)

    // Cierra la sesión de recovery del correo de bienvenida para que ese
    // enlace no pueda reutilizarse: a partir de aquí entra como un usuario
    // normal (Google o correo+contraseña). La contraseña queda asignada.
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/?password_creada=1')
  }

  // Recuperación normal ("olvidé contraseña"): el usuario ya estaba dado de
  // alta; lo dejamos pasar directo a su panel.
  const guard = await checkProfileGuard(supabase, user.id)
  if (!guard.ok) {
    await supabase.auth.signOut()
    return { error: PROFILE_GUARD_MESSAGES[guard.code] }
  }

  revalidatePath('/', 'layout')
  redirect(LANDING_PATH)
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('usuarios')
    .update({
      full_name: formData.get('full_name') as string,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
