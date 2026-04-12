import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
