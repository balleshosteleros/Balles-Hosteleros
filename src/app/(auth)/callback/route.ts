import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { landingPorRol } from '@/features/auth/lib/role-redirect'
import { getRolContext } from '@/features/auth/actions/permisos-actions'
import { checkProfileGuard } from '@/features/auth/lib/profile-guard'
import {
  readAccounts,
  upsertAccount,
  writeAccountsTo,
} from '@/lib/google/accounts'

const TEMP_CLEAR = { path: '/', maxAge: 0 }

function clearPending(response: NextResponse) {
  response.cookies.set('sb_pending_access', '', TEMP_CLEAR)
  response.cookies.set('sb_pending_refresh', '', TEMP_CLEAR)
  response.cookies.set('g_connect_next', '', TEMP_CLEAR)
}

type DeferredWrite = { name: string; value: string; options: CookieOptions }

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const explicitNext = searchParams.get('next')

  if (!code) {
    const fail = NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
    clearPending(fail)
    return fail
  }

  const cookieStore = await cookies()
  const pendingAccess = cookieStore.get('sb_pending_access')?.value
  const pendingRefresh = cookieStore.get('sb_pending_refresh')?.value
  const connectNext = cookieStore.get('g_connect_next')?.value
  const isConnectFlow = !!(pendingAccess && pendingRefresh)

  // Buffer de escrituras del cliente Supabase. Lo aplicamos nosotros a la
  // respuesta al final → control total del estado final de cookies sb-*.
  // Clave: si es connect flow, setSession sobreescribe en este Map las
  // cookies que escribió exchangeCodeForSession, por nombre.
  const sbWrites = new Map<string, DeferredWrite>()

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
            sbWrites.set(name, { name, value, options: options ?? {} })
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    const fail = NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
    clearPending(fail)
    return fail
  }

  const providerToken = data.session.provider_token
  const providerRefreshToken = data.session.provider_refresh_token
  const googleEmail = data.session.user?.email
  const meta = data.session.user?.user_metadata as
    | { avatar_url?: string; picture?: string; full_name?: string; name?: string }
    | undefined
  const picture = meta?.avatar_url || meta?.picture || ''
  const fullName = meta?.full_name || meta?.name || ''

  // Si veníamos de "Conectar / Añadir otra cuenta de Google", restauramos la
  // sesión del software original. setSession sobreescribe en sbWrites las
  // cookies sb-* del Google recién intercambiado.
  if (isConnectFlow) {
    await supabase.auth.setSession({
      access_token: pendingAccess,
      refresh_token: pendingRefresh,
    })
  }

  let target: string | null = explicitNext
  if (!target && isConnectFlow && connectNext) {
    target = connectNext
  }
  if (!target) {
    // Login real: validar que el usuario tenga perfil completo antes de
    // dejarle pasar. Si no, cerramos sesión y mandamos al login con flag.
    const guard = await checkProfileGuard(supabase, data.session.user.id)
    if (!guard.ok) {
      await supabase.auth.signOut()
      const fail = NextResponse.redirect(
        `${origin}/?error=${guard.code}`,
      )
      clearPending(fail)
      return fail
    }
    // Landing por ROL (no por puesto): director/admin → Mis Departamentos;
    // el resto → Mis Paneles. Lo decidimos aquí en el servidor para que cada
    // usuario aterrice directo en su página, sin parpadeo ni rebote en cliente.
    const rolCtx = await getRolContext(data.session.user.id)
    target = landingPorRol(rolCtx.esDirector)
  }

  const response = NextResponse.redirect(`${origin}${target}`)

  // Volcar las escrituras de Supabase a la respuesta. En connect flow son las
  // del usuario original; en login normal son las del nuevo usuario.
  for (const { name, value, options } of sbWrites.values()) {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    )
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  }

  if (providerToken) {
    response.cookies.set('g_access_token', providerToken, cookieOpts)
  }
  if (providerRefreshToken) {
    response.cookies.set('g_refresh_token', providerRefreshToken, cookieOpts)
  }
  if (googleEmail) {
    response.cookies.set('g_email', googleEmail, {
      ...cookieOpts,
      httpOnly: false,
    })
  }
  if (picture) {
    response.cookies.set('g_picture', picture, {
      ...cookieOpts,
      httpOnly: false,
    })
  }
  if (fullName) {
    response.cookies.set('g_name', fullName, {
      ...cookieOpts,
      httpOnly: false,
    })
  }

  if (googleEmail && providerRefreshToken) {
    const previas = await readAccounts()
    const actualizadas = upsertAccount(previas, {
      email: googleEmail,
      name: fullName,
      picture,
      refreshToken: providerRefreshToken,
    })
    writeAccountsTo(response.cookies, actualizadas)
  }

  if (isConnectFlow) clearPending(response)

  return response
}
