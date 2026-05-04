import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { esHostPrincipal } from '@/features/marketing/pagina-web/services/hostname-resolver'
import { getRedirectByRolLabel } from '@/features/auth/lib/role-redirect'

const AUTH_PATHS = ['/', '/signup', '/callback', '/forgot-password', '/update-password', '/check-email']
const PUBLIC_PREFIXES = ['/carta', '/__site', '/api/google/connect']

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

export async function updateSession(request: NextRequest) {
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
      return res
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

  // Rutas auth: signup, reset, etc. → libres
  // Rutas públicas: carta digital, sitios externos, assets, api → libres
  if (isAuthPath(pathname) || isPublicPath(pathname)) {
    // Si ya estás logueado y visitas la home/login → te mando a tu módulo
    // (excepto en host demo, donde "/" siempre debe mostrar el formulario)
    if (pathname === '/' && user && !isDemoHost) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol_label')
        .eq('user_id', user.id)
        .maybeSingle()
      const target = getRedirectByRolLabel(profile?.rol_label as string | null)
      return NextResponse.redirect(new URL(target, request.url))
    }
    return supabaseResponse
  }

  // Resto: privado → requiere sesión
  if (!user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}
