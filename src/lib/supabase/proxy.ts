import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { esHostPrincipal } from '@/features/marketing/pagina-web/services/hostname-resolver'

export async function updateSession(request: NextRequest) {
  // ── Hostname rewrite: dominios custom de páginas web ────────────────
  // Si el host NO es el principal del SaaS, reescribimos a (public-site)
  // para que el catch-all resuelva por hostname.
  const rawHost =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  if (rawHost && !esHostPrincipal(rawHost)) {
    // Rewrite a /__site/{path} para aislar las rutas públicas del panel
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

  // DEV bypass — sin redirecciones ni guard
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true") {
    return supabaseResponse
  }

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

  // Rutas protegidas
  const pathname = request.nextUrl.pathname
  const isProtectedRoute = pathname.startsWith('/dashboard')
  const isAuthRoute =
    pathname === '/' ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/callback') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/check-email')

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (isAuthRoute && user && !isDemoHost) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
