import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { updateSession } from '@/lib/supabase/proxy'

const MODULO_POR_PREFIJO: Array<[string, string]> = [
  ['/direccion', 'DIRECCIÓN'],
  ['/sala', 'SALA'],
  ['/cocina', 'COCINA'],
  ['/gerencia', 'GERENCIA'],
  ['/calidad', 'CALIDAD'],
  ['/rrhh', 'RRHH'],
  ['/marketing', 'MARKETING'],
  ['/logistica', 'LOGÍSTICA'],
  ['/contabilidad', 'CONTABILIDAD'],
  ['/gestoria', 'GESTORÍA'],
  ['/juridico', 'JURÍDICO'],
  ['/ajustes', 'AJUSTES'],
]

const COMBINING_MARKS = /[̀-ͯ]/g
function normalizar(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase().trim()
}

function moduloRequerido(pathname: string): string | null {
  for (const [prefijo, modulo] of MODULO_POR_PREFIJO) {
    if (pathname === prefijo || pathname.startsWith(prefijo + '/')) {
      return modulo
    }
  }
  return null
}

export async function proxy(request: NextRequest) {
  // Paso 1: refresco de sesión + rewrite de hostnames custom + redirect
  // de "/" hacia el módulo del usuario logueado.
  const sessionResponse = await updateSession(request)

  // Si updateSession devolvió un redirect/rewrite, respétalo.
  if (sessionResponse.status >= 300 && sessionResponse.status < 400) {
    return sessionResponse
  }

  // Paso 2: autorización por módulo (solo para prefijos protegidos).
  const pathname = request.nextUrl.pathname
  const moduloReq = moduloRequerido(pathname)
  if (!moduloReq) return sessionResponse

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          /* cookies ya gestionadas por updateSession */
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return sessionResponse

  // Bypass local para el usuario de dirección
  if (user.email === 'REDACTED@local') {
    return sessionResponse
  }

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !serviceKey) {
    console.warn('[proxy] SUPABASE_SERVICE_ROLE_KEY no configurada — saltando enforcement')
    return sessionResponse
  }
  const admin = createSupabaseClient(adminUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Marca actividad real del usuario en la app. Auto-throttled a 30s vía WHERE
  // para que múltiples pestañas/recargas no inflen la BD: si la última marca
  // es reciente, el UPDATE no toca filas y vuelve casi gratis.
  const cutoff = new Date(Date.now() - 30_000).toISOString()
  const ahora = new Date().toISOString()

  const [{ data: profile }, { data: rolesRows }] = await Promise.all([
    admin
      .from('profiles')
      .select('rol_label, empresa_id, estado_acceso')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id),
    admin
      .from('profiles')
      .update({ ultima_actividad: ahora })
      .eq('user_id', user.id)
      .or(`ultima_actividad.is.null,ultima_actividad.lt.${cutoff}`),
  ])

  // Cuenta deshabilitada (p.ej. el empleado fue dado de baja en RRHH y el
  // trigger sync_profile_estado_from_empleado puso estado_acceso=Inactivo).
  // Cerramos sesión y mandamos al login con un flag para que la UI lo explique.
  const estadoAcceso = (profile?.estado_acceso as string | null) ?? null
  if (estadoAcceso === 'Inactivo') {
    await supabase.auth.signOut()
    const url = new URL('/', request.url)
    url.searchParams.set('error', 'cuenta_inactiva')
    return NextResponse.redirect(url)
  }

  const appRoles = (rolesRows ?? []).map((r) => r.role as string)

  // 'director' tiene bypass total — es el rol más alto del SaaS.
  if (appRoles.includes('director')) return sessionResponse

  const rolLabel = (profile?.rol_label as string | null) ?? null
  const empresaId = (profile?.empresa_id as string | null) ?? null
  if (!rolLabel || !empresaId) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const { data: rolRow } = await admin
    .from('empresa_roles')
    .select('permisos')
    .eq('empresa_id', empresaId)
    .ilike('nombre', rolLabel)
    .maybeSingle()

  const permisos = (rolRow?.permisos ?? []) as Array<{ modulo: string; ver: boolean; editar: boolean }>
  const moduloReqNorm = normalizar(moduloReq)
  const allowed = permisos.some((p) => p.ver && normalizar(p.modulo) === moduloReqNorm)

  if (!allowed) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return sessionResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static
     * - _next/image
     * - favicon.ico, robots.txt, sitemap.xml
     * - svg/png/jpg/jpeg/gif/webp
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)',
  ],
}
