import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRedirectByRolLabel } from '@/features/auth/lib/role-redirect'
import {
  readAccounts,
  upsertAccount,
  writeAccountsTo,
} from '@/lib/google/accounts'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const explicitNext = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      let target = explicitNext
      if (!target) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol_label')
          .eq('user_id', data.session.user.id)
          .maybeSingle()
        target = getRedirectByRolLabel(profile?.rol_label as string | null)
      }
      const response = NextResponse.redirect(`${origin}${target}`)

      // Si la sesión viene con tokens de Google (provider_token), los
      // guardamos en cookies httpOnly para que las rutas /api/google/*
      // puedan llamar a Gmail y Calendar en nombre del usuario.
      const providerToken = data.session.provider_token
      const providerRefreshToken = data.session.provider_refresh_token
      const email = data.session.user?.email
      const meta = data.session.user?.user_metadata as
        | { avatar_url?: string; picture?: string; full_name?: string; name?: string }
        | undefined
      const picture = meta?.avatar_url || meta?.picture || ''
      const fullName = meta?.full_name || meta?.name || ''

      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        // 60 días — refresh token vive bastante
        maxAge: 60 * 60 * 24 * 60,
      }

      if (providerToken) {
        response.cookies.set('g_access_token', providerToken, cookieOpts)
      }
      if (providerRefreshToken) {
        response.cookies.set('g_refresh_token', providerRefreshToken, cookieOpts)
      }
      if (email) {
        response.cookies.set('g_email', email, {
          ...cookieOpts,
          httpOnly: false, // este sí lo lee el cliente para mostrar
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

      // Roster multi-cuenta: si esta sesión trae refresh token, lo guardamos
      // junto a las demás cuentas conectadas (dedupe por email). La cuenta
      // recién logueada queda como activa en las cookies `g_*` de arriba.
      if (email && providerRefreshToken) {
        const previas = await readAccounts()
        const actualizadas = upsertAccount(previas, {
          email,
          name: fullName,
          picture,
          refreshToken: providerRefreshToken,
        })
        writeAccountsTo(response.cookies, actualizadas)
      }

      return response
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`)
}
