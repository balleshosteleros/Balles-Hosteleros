import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { checkProfileGuard } from '@/features/auth/lib/profile-guard'
import { LANDING_PATH } from '@/features/auth/lib/role-redirect'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * `signInWithIdToken` da de alta en `auth.users` a cualquier cuenta de Google que
 * pulse el botón, y un trigger le crea una ficha vacía en `usuarios`. Si esa cuenta
 * no es un usuario invitado válido, hay que borrar ese residuo para no dejar logins
 * fantasma. Solo se limpia cuando el perfil no existe o no tiene empresa (firma
 * inequívoca de un alta automática); a un usuario real desactivado (`cuenta_inactiva`)
 * o medio configurado (`sin_rol`) NO se le toca, solo se cierra la sesión.
 */
async function purgeOrphanUser(userId: string) {
  try {
    const admin = createAdminClient()
    await admin.from('usuario_preferencias').delete().eq('user_id', userId)
    await admin.from('usuarios').delete().eq('user_id', userId)
    await admin.auth.admin.deleteUser(userId)
  } catch {
    // Si la limpieza falla, el login se rechaza igualmente más abajo.
  }
}

type DeferredWrite = { name: string; value: string; options: CookieOptions }

export async function POST(request: Request) {
  let body: { token?: unknown; nonce?: unknown; redirectTo?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, code: 'auth_callback_failed' },
      { status: 400 },
    )
  }

  const token = typeof body.token === 'string' ? body.token : null
  const nonce = typeof body.nonce === 'string' ? body.nonce : null
  const redirectTo =
    typeof body.redirectTo === 'string' && body.redirectTo.startsWith('/')
      ? body.redirectTo
      : null

  if (!token || !nonce) {
    return NextResponse.json(
      { ok: false, code: 'auth_callback_failed' },
      { status: 400 },
    )
  }

  const cookieStore = await cookies()
  const writes = new Map<string, DeferredWrite>()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            writes.set(name, { name, value, options: options ?? {} })
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token,
    nonce,
  })

  if (error || !data?.session) {
    return NextResponse.json(
      { ok: false, code: 'auth_callback_failed' },
      { status: 401 },
    )
  }

  const guard = await checkProfileGuard(supabase, data.session.user.id)
  if (!guard.ok) {
    const userId = data.session.user.id
    await supabase.auth.signOut()
    // Cuenta de Google no invitada → borrar el login auto-creado (sin dejar fantasmas).
    if (guard.code === 'sin_perfil' || guard.code === 'sin_empresa') {
      await purgeOrphanUser(userId)
    }
    const fail = NextResponse.json(
      { ok: false, code: guard.code },
      { status: 403 },
    )
    for (const { name, value, options } of writes.values()) {
      fail.cookies.set(
        name,
        value,
        options as Parameters<typeof fail.cookies.set>[2],
      )
    }
    return fail
  }

  const target = redirectTo ?? LANDING_PATH
  const response = NextResponse.json({ ok: true, target })
  for (const { name, value, options } of writes.values()) {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    )
  }
  return response
}
