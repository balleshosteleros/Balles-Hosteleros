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

// Cookie de puerta ya comprobada. Guarda el veredicto del Paso 3 durante unos
// segundos para no repetir las consultas de perfil y rol en CADA petición.
//
// Sin esto, una sola navegación (documento + su cascada de peticiones RSC y
// server actions) disparaba el UPDATE de actividad + SELECT de perfil + SELECT
// de rol varias veces seguidas. Con la red lenta o el pool de Supabase ocupado,
// alguna se pasaba de tiempo, el proxy lanzaba excepción y Next respondía con
// su página de error (`<html id="__next_error__">`): "This page couldn't load"
// en cada clic. El caso real fue Alejandro (2 empresas y el mayor número de
// notificaciones: las peticiones más pesadas y las primeras en caerse).
const COOKIE_PUERTA = 'bh_puerta_ok'
const PUERTA_TTL_S = 30

// ¿Es una petición INTERNA de Next (RSC / prefetch), no una navegación real?
//
// Al pulsar un submódulo, Next pide primero el documento y DESPUÉS lanza una
// ráfaga de peticiones RSC para el mismo destino. Un redirect contestado a una
// de esas peticiones no se ve como un bloqueo limpio: la pantalla ya se ha
// pintado, así que el usuario ve el submódulo y un segundo después se le
// expulsa al índice del módulo. Quien decide el acceso es la navegación real
// (el documento); estas peticiones derivadas no deben redirigir a nadie.
function esPeticionInterna(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.has('_rsc') ||
    request.headers.get('rsc') === '1' ||
    request.headers.get('next-router-prefetch') === '1'
  )
}

export async function proxy(request: NextRequest) {
  try {
    return await proxyInterno(request)
  } catch (e) {
    // NUNCA tumbar la navegación por un fallo del guardia. Si la comprobación
    // no se puede completar (timeout de Supabase, red), dejamos pasar la
    // petición: la autorización real vuelve a validarse en cada server action
    // y en cada route handler, así que esto no abre ninguna puerta.
    console.error('[proxy] fallo no controlado — se deja pasar la petición:', e)
    return NextResponse.next()
  }
}

async function proxyInterno(request: NextRequest) {
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

  if (!user) return sessionResponse

  // ¿Hay que comprobar la puerta en esta petición?
  //
  // La puerta (estado_acceso / empresa) se comprueba una vez cada PUERTA_TTL_S
  // por usuario, no en cada petición. El veredicto viaja en una cookie de
  // sesión atada al `user.id`: si otro usuario entra en el mismo navegador la
  // cookie no le sirve, y al caducar se vuelve a comprobar contra la BD.
  //
  // Las rutas de módulo (/rrhh, /gerencia…) SIEMPRE comprueban permisos abajo:
  // la caché solo evita repetir la puerta, nunca el filtro por módulo.
  const moduloReq = moduloRequerido(pathname)
  const puertaCacheada = request.cookies.get(COOKIE_PUERTA)?.value === user.id
  // Sin módulo que autorizar y con la puerta ya validada hace poco: no hay nada
  // que consultar. Este es el atajo que devuelve el `return` temprano que el
  // commit e0a87e95 había eliminado, pero SIN reabrir el agujero: la puerta se
  // sigue comprobando, solo que una vez cada PUERTA_TTL_S en lugar de siempre.
  if (!moduloReq && puertaCacheada) return sessionResponse

  const adminUrlActividad = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKeyActividad = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Paso 2: marca de actividad. Va ANTES del filtro por módulo a propósito: si
  // solo se marcara en rutas de módulo (/rrhh, /gerencia…), quien entra desde el
  // móvil (/m) o se queda en Mi Panel / Mis Departamentos / la portada nunca
  // dejaría rastro y su "última conexión" saldría vacía para siempre.
  // Auto-throttled a 30s vía WHERE para que múltiples pestañas/recargas no
  // inflen la BD: si la última marca es reciente, el UPDATE no toca filas.
  if (adminUrlActividad && serviceKeyActividad) {
    const adminActividad = createSupabaseClient(adminUrlActividad, serviceKeyActividad, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const cutoffActividad = new Date(Date.now() - 30_000).toISOString()
    // Sin `await`: la marca de actividad es un apunte informativo ("última
    // conexión" en Ajustes → Usuarios), no una comprobación de seguridad.
    // Esperarla sumaba una ida y vuelta a la BD a cada petición y, si tardaba,
    // arrastraba a toda la navegación. Que falle no debe costarle nada al
    // usuario: por eso se lanza y se ignora el resultado.
    void adminActividad
      .from('usuarios')
      .update({ ultima_actividad: new Date().toISOString() })
      .eq('user_id', user.id)
      .or(`ultima_actividad.is.null,ultima_actividad.lt.${cutoffActividad}`)
      .then(({ error }) => {
        if (error) console.error('[proxy] marca de actividad:', error.message)
      })
  }

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
    // FAIL-CLOSED. Sin la service key no se pueden leer rol ni permisos, así que
    // no hay forma de saber si este usuario puede entrar. Antes se devolvía la
    // respuesta tal cual ("saltando enforcement"): el guardia se rendía y dejaba
    // pasar a CUALQUIERA a CUALQUIER módulo con solo escribir la URL. Si no se
    // puede comprobar, no se pasa.
    console.error('[proxy] SUPABASE_SERVICE_ROLE_KEY no configurada — se deniega el acceso')
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/', request.url))
  }
  const admin = createSupabaseClient(adminUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error: profileError } = await admin
    .from('usuarios')
    .select('rol_id, rol_label, empresa_id, estado_acceso')
    .eq('user_id', user.id)
    .maybeSingle()

  // Misma regla que abajo con el rol: si la consulta FALLA no sabemos nada del
  // usuario, y aquí el precio de equivocarse es aún más alto (este bloque cierra
  // la sesión). "No he podido comprobarlo" nunca puede tratarse como "no tiene
  // ficha": se deja pasar y la autorización real se revalida más adelante.
  if (profileError) {
    console.error('[proxy] no se pudo comprobar el perfil — se deja pasar:', profileError)
    return sessionResponse
  }

  // Paso 3: PUERTA DE ACCESO. Va ANTES del filtro por módulo a propósito.
  // Si se comprobara solo en rutas de módulo (/rrhh, /gerencia…), una cuenta
  // Inactiva o sin empresa seguiría entrando por Mi Panel, el móvil (/m) o la
  // portada — que es justo lo que pasaba: una cuenta "Inactiva" y sin empresa
  // navegaba con normalidad y ni siquiera aparecía en Ajustes → Usuarios
  // (esa pantalla filtra por empresa activa, así que era invisible).
  const estadoAcceso = (profile?.estado_acceso as string | null) ?? null
  const rolId = (profile?.rol_id as string | null) ?? null
  const rolLabel = (profile?.rol_label as string | null) ?? null
  const empresaId = (profile?.empresa_id as string | null) ?? null

  // Sin ficha en `usuarios`: cuenta huérfana en Auth. No debe navegar.
  // Inactivo: cuenta deshabilitada (p.ej. baja en RRHH → el trigger
  // sync_profile_estado_from_empleado pone estado_acceso=Inactivo).
  // Sin empresa: cuenta a medio crear; no pertenece a ningún sitio.
  const motivoBloqueo = !profile
    ? 'sin_ficha'
    : estadoAcceso === 'Inactivo'
      ? 'cuenta_inactiva'
      : !empresaId
        ? 'sin_empresa'
        : null

  if (motivoBloqueo) {
    await supabase.auth.signOut()
    const url = new URL('/', request.url)
    url.searchParams.set('error', motivoBloqueo === 'cuenta_inactiva' ? 'cuenta_inactiva' : 'sin_acceso')
    const redir = NextResponse.redirect(url)
    // La cuenta acaba de ser expulsada: fuera el veredicto cacheado.
    redir.cookies.delete(COOKIE_PUERTA)
    return redir
  }

  // Puerta superada: la sellamos unos segundos para que la ráfaga de peticiones
  // de esta misma navegación no repita las consultas de perfil y rol.
  sessionResponse.cookies.set(COOKIE_PUERTA, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PUERTA_TTL_S,
  })

  // Paso 4: autorización por módulo (solo para prefijos protegidos).
  if (!moduloReq) return sessionResponse

  // Las peticiones internas de Next no expulsan (ver `esPeticionInterna`).
  if (esPeticionInterna(request)) return sessionResponse

  if (!rolId && !rolLabel) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Rol del usuario (fuente única PRP-063): por rol_id; fallback defensivo a
  // rol_label (texto) por si algún usuario en transición aún no tiene rol_id.
  const rolQuery = admin.from('empresa_roles').select('permisos, es_admin_plataforma')
  const { data: rolRow, error: rolError } = rolId
    ? await rolQuery.eq('id', rolId).maybeSingle()
    : await rolQuery.eq('empresa_id', empresaId).ilike('nombre', rolLabel as string).maybeSingle()

  // La consulta del rol FALLÓ (timeout, pool ocupado, red). Eso NO significa
  // "sin permisos": significa "no lo he podido comprobar". Tratarlo como una
  // denegación expulsaba a un usuario legítimo en mitad de la navegación — la
  // página se pintaba y un segundo después saltaba fuera del submódulo, porque
  // basta con que falle UNA de la ráfaga de peticiones de esa navegación.
  // Se deja pasar, igual que hace el catch general de `proxy()`: la
  // autorización real se revalida en cada server action y route handler.
  if (rolError) {
    console.error('[proxy] no se pudo comprobar el rol — se deja pasar:', rolError)
    return sessionResponse
  }

  // Sin bypass de 'director' (es_admin_plataforma): el acceso a cada ruta lo
  // decide SIEMPRE el permiso del rol configurado en Ajustes → Roles. Antes,
  // ser admin de plataforma abría las 12 rutas protegidas sin mirar `permisos`,
  // así que los toggles de dirección no surtían efecto.
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
