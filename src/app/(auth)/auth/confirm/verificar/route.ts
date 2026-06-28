import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Canje server-side del token del enlace de correo (recovery / alta).
 *
 * Solo se llega aquí por POST, desde el botón "Crear mi contraseña" de
 * /auth/confirm. Esto evita que el prefetch de los clientes de correo (que solo
 * hace GET) consuma el token antes de tiempo. verifyOtp es de un solo uso: si el
 * token ya se gastó o caducó, redirigimos a /update-password?estado=usado para
 * mostrar "este enlace ya se ha usado".
 */
export async function POST(request: Request) {
  const { origin } = new URL(request.url)
  const form = await request.formData()
  const tokenHash = (form.get('token_hash') as string) || ''
  const type = ((form.get('type') as string) || 'recovery') as EmailOtpType
  const nextRaw = (form.get('next') as string) || '/update-password'
  // Solo rutas internas (evita open-redirect).
  const next = nextRaw.startsWith('/') ? nextRaw : '/update-password'

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}${next}?estado=invalido`, { status: 303 })
  }

  const cookieStore = await cookies()
  const sbWrites = new Map<string, { name: string; value: string; options: CookieOptions }>()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            sbWrites.set(name, { name, value, options: options ?? {} }),
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    return NextResponse.redirect(`${origin}${next}?estado=usado`, { status: 303 })
  }

  // Sesión de recovery creada: volcamos las cookies sb-* y abrimos el formulario.
  const response = NextResponse.redirect(`${origin}${next}?estado=recovery`, { status: 303 })
  sbWrites.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  )
  return response
}
