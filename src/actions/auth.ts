'use server'

import { headers, cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { landingPorRol } from '@/features/auth/lib/role-redirect'
import { getRolContext } from '@/features/auth/actions/permisos-actions'
import {
  SESION_INICIO_COOKIE,
  SESION_INICIO_DUENO_COOKIE,
} from '@/features/auth/lib/session-expiry'
import {
  checkProfileGuard,
  PROFILE_GUARD_MESSAGES,
} from '@/features/auth/lib/profile-guard'
import { getSiteUrl } from '@/lib/site-url'

// Mensaje ÚNICO de acceso denegado (decisión de Ivan, 2026-08-05): el mismo
// se escriba usuario/contraseña o se entre por Google. Debe coincidir con el de
// LoginForm.tsx, profile-guard.ts y el trigger handle_new_user de la BD.
const ACCESO_DENEGADO_MESSAGE = 'Esta cuenta no tiene acceso al sistema.'

function translateAuthError(message: string | undefined): string {
  if (!message) return 'No se pudo iniciar sesión.'
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return ACCESO_DENEGADO_MESSAGE
  }
  if (m.includes('email not confirmed')) {
    return 'El correo aún no ha sido confirmado.'
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Demasiados intentos. Inténtalo de nuevo en unos minutos.'
  }
  if (m.includes('user not found')) {
    return ACCESO_DENEGADO_MESSAGE
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

  // Entrada por correo+contraseña: aquí SÍ se exige haber estrenado la propia
  // contraseña (por Google no, ver checkProfileGuard).
  const guard = await checkProfileGuard(supabase, data.user.id, {
    exigirPassword: true,
  })
  if (!guard.ok) {
    await supabase.auth.signOut()
    return { error: PROFILE_GUARD_MESSAGES[guard.code] }
  }

  // Landing por ROL: director/admin → Mis Departamentos; resto → Mis Paneles.
  const { esDirector } = await getRolContext(data.user.id)
  revalidatePath('/', 'layout')
  redirect(landingPorRol(esDirector))
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

  // Reloj de caducidad de 8h: se borra para que el próximo login arranque limpio.
  const cookieStore = await cookies()
  cookieStore.delete(SESION_INICIO_COOKIE)
  cookieStore.delete(SESION_INICIO_DUENO_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/')
}

// Mensaje cuando el correo escrito no pertenece a ningún usuario del sistema.
// Decisión de Ivan (2026-09-02): la pantalla NO puede decir "revisa tu correo"
// cuando no se ha enviado nada — el usuario se quedaba esperando un email que
// nunca iba a llegar. Se corta el proceso y se dice la verdad.
const EMAIL_SIN_CUENTA_MESSAGE =
  'Ese correo no está asociado a ninguna cuenta del sistema. Comprueba que sea el correo con el que accedes.'

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (!email) {
    return { error: EMAIL_SIN_CUENTA_MESSAGE }
  }

  // Supabase responde "enviado" siempre, exista o no la dirección (protección
  // anti-enumeración). Por eso la existencia se comprueba aquí, contra la
  // tabla de usuarios, ANTES de pedir el envío: el correo de acceso es
  // usuarios.email. Se usa el cliente admin porque esta pantalla es pública
  // (sin sesión) y la RLS no dejaría leer nada.
  let existe = false
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('usuarios')
      .select('id')
      .ilike('email', email)
      .limit(1)

    // Si la comprobación falla (BD caída, falta la service key), NO se bloquea
    // al usuario legítimo: se sigue adelante y que Supabase decida.
    if (error) {
      existe = true
    } else {
      existe = (data?.length ?? 0) > 0
    }
  } catch {
    existe = true
  }

  if (!existe) {
    return { error: EMAIL_SIN_CUENTA_MESSAGE }
  }

  // URL base centralizada en getSiteUrl(): NEXT_PUBLIC_APP_URL → SITE_URL →
  // VERCEL_URL → localhost, y en producción falla si cae a localhost (guard).
  const siteUrl = getSiteUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/update-password`,
  })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  return { success: true }
}

// Política de contraseña del sistema: exactamente 6 dígitos numéricos.
// Tipo PIN: rápida de teclear y de recordar, también para reautenticar en la
// bóveda de contraseñas. Fuente única de verdad (el HTML solo es ayuda visual).
const PIN_REGEX = /^\d{6}$/
const PIN_ERROR = 'La contraseña debe tener exactamente 6 dígitos numéricos (ej. 042815).'

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  if (!PIN_REGEX.test(password ?? '')) {
    return { error: PIN_ERROR }
  }

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

  const { esDirector } = await getRolContext(user.id)
  revalidatePath('/', 'layout')
  redirect(landingPorRol(esDirector))
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
