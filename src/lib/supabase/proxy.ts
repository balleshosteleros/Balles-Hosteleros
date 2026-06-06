import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { esHostPrincipal } from '@/features/marketing/pagina-web/services/hostname-resolver'
import { LANDING_PATH } from '@/features/auth/lib/role-redirect'
import { checkProfileGuard } from '@/features/auth/lib/profile-guard'

export type UpdateSessionResult = {
  response: NextResponse
  /** Usuario ya validado por GoTrue (o null). El proxy lo reutiliza en vez de
   * volver a llamar a auth.getUser() — cada getUser() es otra ida a la red. */
  user: User | null
}

const AUTH_PATHS = ['/', '/callback', '/forgot-password', '/update-password', '/check-email', '/acceso-demo']
const PUBLIC_PREFIXES = ['/carta', '/__site', '/api/google/connect', '/empleo', '/api/empleo', '/firmar', '/inspectores', '/inspecciones/verificar', '/v', '/r', '/api/visita']

function isAuthPath(pathname: string) {
  if (pathname === '/') return true
  return AUTH_PATHS.some((p) => p !== '/' && pathname.startsWith(p))
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/api/')) return true
  if (/\.[a-z0-9]+$/i.test(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  // Alias /login → / (la pantalla de login vive en la raíz)
  if (request.nextUrl.pathname === '/login') {
    const target = request.nextUrl.clone()
    target.pathname = '/'
    return { response: NextResponse.redirect(target), user: null }
  }

  // ── Hostname rewrite: dominios custom de páginas web ────────────────
  const rawHost =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  if (rawHost && !esHostPrincipal(rawHost)) {
    const pathname = request.nextUrl.pathname
    const isAsset = /\.[a-z0-9]+$/i.test(pathname) || pathname.startsWith('/api/') || pathname.startsWith('/_next/')
    if (!isAsset) {
      const target = request.nextUrl.clone()
      target.pathname = `/__site${pathname === '/' ? '' : pathname}`
      const res = NextResponse.rewrite(target)
      res.headers.set('x-paginas-web-host', rawHost)
      return { response: res, user: null }
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Host demo: el formulario de demo debe mostrarse siempre en "/",
  // incluso si hay sesión activa. Así cada visitante empieza limpio.
  const normalizedHost = (rawHost || '').toLowerCase().split(':')[0]
  const isDemoHost =
    normalizedHost === 'demo.balleshosteleros.com' ||
    normalizedHost.startsWith('demo.')

  const pathname = request.nextUrl.pathname

  // Rutas auth: callback, reset, etc. → libres
  // Rutas públicas: carta digital, sitios externos, assets, api → libres
  if (isAuthPath(pathname) || isPublicPath(pathname)) {
    // Si ya estás logueado y visitas la home/login → te mando a tu landing
    // (excepto en host demo, donde "/" siempre debe mostrar el formulario)
    if (pathname === '/' && user && !isDemoHost) {
      // Validamos profile antes de redirigir. Si el usuario tiene sesión
      // pero su profile no es válido (sin empresa, sin rol, inactivo, etc.),
      // cerramos sesión y dejamos que vea el login.
      const guard = await checkProfileGuard(supabase, user.id)
      if (!guard.ok) {
        await supabase.auth.signOut()
        const url = new URL('/', request.url)
        url.searchParams.set('error', guard.code)
        return { response: NextResponse.redirect(url), user: null }
      }
      return {
        response: NextResponse.redirect(new URL(LANDING_PATH, request.url)),
        user,
      }
    }
    return { response: supabaseResponse, user }
  }

  // Resto: privado → requiere sesión
  if (!user) {
    return { response: NextResponse.redirect(new URL('/', request.url)), user: null }
  }

  // Y además, perfil completo y activo. Sin esto, un usuario que entrara
  // por OAuth (o que perdió su empresa/rol) podría navegar a rutas privadas
  // que no estén bajo los 12 prefijos de módulo del proxy raíz.
  const guard = await checkProfileGuard(supabase, user.id)
  if (!guard.ok) {
    await supabase.auth.signOut()
    const url = new URL('/', request.url)
    url.searchParams.set('error', guard.code)
    return { response: NextResponse.redirect(url), user: null }
  }

  return { response: supabaseResponse, user }
}
