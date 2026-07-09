import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { updateSession } from '@/lib/supabase/proxy'

// NOTA (PRP-045): el redirect móvil → /m se hace ahora en next.config.ts
// (`redirects()` con `has: header user-agent`) porque se aplica a nivel
// de routing edge — antes del cache estático y antes de este proxy.
// El Paso 0 que vivía aquí quedó redundante y se eliminó.

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

const MODULO_ALIASES: Record<string, string[]> = {
  RRHH: ['RRHH', 'RECURSOS HUMANOS'],
}

function modulosPermitidos(modulo: string): string[] {
  const moduloNorm = normalizar(modulo)
  return MODULO_ALIASES[moduloNorm] ?? [moduloNorm]
}

// Rutas PÚBLICAS bajo prefijos protegidos: enlaces tokenizados que abren
// personas SIN cuenta en el sistema (no requieren login ni rol). El token de un
// solo uso ya es la autorización. P.ej. la gestoría externa sube el contrato
// firmado desde `/gestoria/contrato/<token>` sin entrar al sistema.
const RUTAS_PUBLICAS_TOKENIZADAS = [
  '/gestoria/contrato/', // subida de contrato por la gestoría (token único)
  '/gestoria/modelos/', // subida de modelos fiscales por la gestoría (PRP-072)
]

function esRutaPublicaTokenizada(pathname: string): boolean {
  return RUTAS_PUBLICAS_TOKENIZADAS.some((p) => pathname.startsWith(p))
}

function moduloRequerido(pathname: string): string | null {
  // Las rutas públicas tokenizadas nunca exigen módulo/login.
  if (esRutaPublicaTokenizada(pathname)) return null
  for (const [prefijo, modulo] of MODULO_POR_PREFIJO) {
    if (pathname === prefijo || pathname.startsWith(prefijo + '/')) {
      return modulo
    }
  }
  return null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Paso 1: refresco de sesión + rewrite de hostnames custom + redirect
  // de "/" hacia el módulo del usuario logueado.
  // `user` viene ya validado por updateSession → así el Paso 2 no repite
  // auth.getUser() (otra ida a la red a GoTrue) en cada request de módulo.
  const { response: sessionResponse, user } = await updateSession(request)

  // Si updateSession devolvió un redirect/rewrite, respétalo.
  if (sessionResponse.status >= 300 && sessionResponse.status < 400) {
    return sessionResponse
  }

  // Paso 2: autorización por módulo (solo para prefijos protegidos).
  const moduloReq = moduloRequerido(pathname)
  if (!moduloReq) return sessionResponse

  if (!user) return sessionResponse

  // Cliente SSR solo para signOut si la cuenta está inactiva (abajo).
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

  const [{ data: profile }] = await Promise.all([
    admin
      .from('usuarios')
      .select('rol_id, rol_label, empresa_id, estado_acceso')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('usuarios')
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

  const rolId = (profile?.rol_id as string | null) ?? null
  const rolLabel = (profile?.rol_label as string | null) ?? null
  const empresaId = (profile?.empresa_id as string | null) ?? null

  if ((!rolId && !rolLabel) || !empresaId) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Rol del usuario (fuente única PRP-063): por rol_id; fallback defensivo a
  // rol_label (texto) por si algún usuario en transición aún no tiene rol_id.
  const rolQuery = admin.from('empresa_roles').select('permisos, es_admin_plataforma')
  const { data: rolRow } = rolId
    ? await rolQuery.eq('id', rolId).maybeSingle()
    : await rolQuery.eq('empresa_id', empresaId).ilike('nombre', rolLabel as string).maybeSingle()

  // 'director' (es_admin_plataforma) es rol tenant: bypass condicionado a que
  // sea miembro real de su empresa activa (user_empresas, fuente canónica).
  if (rolRow?.es_admin_plataforma && empresaId) {
    const { data: membership } = await admin
      .from('usuario_empresas')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (membership) return sessionResponse
  }

  const permisos = (rolRow?.permisos ?? []) as Array<{ modulo: string; ver: boolean; editar: boolean }>
  const modulosReqNorm = new Set(modulosPermitidos(moduloReq))
  const allowed = permisos.some((p) => p.ver && modulosReqNorm.has(normalizar(p.modulo)))

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
