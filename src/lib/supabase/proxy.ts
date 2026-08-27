import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { esHostPrincipal, esHostQr } from '@/features/marketing/pagina-web/services/hostname-resolver'
import { LANDING_PATH } from '@/features/auth/lib/role-redirect'
import { checkProfileGuard } from '@/features/auth/lib/profile-guard'
import {
  SESION_INICIO_COOKIE,
  SESION_EXPIRADA_CODE,
  esDispositivoMovil,
  sesionCaducada,
} from '@/features/auth/lib/session-expiry'

export type UpdateSessionResult = {
  response: NextResponse
  /** Usuario ya validado por GoTrue (o null). El proxy lo reutiliza en vez de
   * volver a llamar a auth.getUser() — cada getUser() es otra ida a la red. */
  user: User | null
}

// `/salir` es la salida de emergencia: tiene que ser alcanzable SIEMPRE, con o sin
// sesión. Si no fuera pública, el proxy la mandaría al login antes de ejecutarse y
// nunca llegaría a borrar las cookies (que son HttpOnly: solo el servidor puede).
const AUTH_PATHS = ['/', '/salir', '/callback', '/auth/confirm', '/forgot-password', '/update-password', '/check-email', '/acceso-demo']
const PUBLIC_PREFIXES = ['/carta', '/sitio-publico', '/api/google/connect', '/api/google/vincular-callback', '/empleo', '/api/empleo', '/documentacion', '/api/documentacion', '/firmar', '/inspectores', '/inspecciones/verificar', '/v', '/r', '/api/visita',
  // Redirección de códigos QR: la abre un cliente anónimo con el móvil desde una
  // carta impresa. Si exigiera login, el QR mandaría al cliente a la pantalla de
  // acceso del sistema en vez de a la carta.
  '/q',
  // Subida de contrato por la gestoría externa (enlace tokenizado, sin cuenta).
  '/gestoria/contrato', '/api/gestoria/contrato',
  // Documentos oficiales de la BAJA (justificante del RED + certificado SEPE),
  // que la gestoría adjunta por su enlace tokenizado, también sin cuenta.
  '/gestoria/baja', '/api/gestoria/baja',
  // Subida de modelos fiscales por la gestoría (PRP-072, enlace tokenizado).
  '/gestoria/modelos', '/api/gestoria/modelos',
  // Subida MENSUAL de nóminas por la gestoría (enlace tokenizado). Faltaba: el
  // correo que se le envía cada mes la mandaba al login en vez de a la pantalla
  // de subida.
  '/gestoria/nominas', '/api/gestoria/nominas',
  // Formación del candidato en fase «Formación» (aún sin cuenta): enlace
  // tokenizado /formacion/<token> que muestra el curso de su puesto.
  '/formacion',
  // Vista previa del editor de páginas web. La abre el botón «Ver» en una
  // pestaña nueva (con `noopener`), y ahí la sesión no siempre acompaña: al
  // caer en el bloque privado de abajo, el proxy la mandaba a `/?auth=1`. Como
  // lo que se abría era el login dentro de una pestaña que esperaba una web,
  // se quedaba cargando sin pintar nada.
  //
  // Pasa por aquí solo para NO rebotar al login. El borrador es material
  // interno, así que la propia página exige sesión + empresa antes de
  // enseñar nada (ver src/app/pagina-web-preview/[id]/page.tsx).
  '/pagina-web-preview',
  // Landing comercial del SaaS y sus cuatro documentos legales (aviso legal,
  // privacidad, cookies y términos). Son páginas de venta: si el proxy las
  // manda al login, quien llega desde Google se encuentra una pantalla de
  // acceso en vez de la web del producto.
  //
  // Además es REQUISITO de la verificación OAuth de Google: el revisor abre la
  // política de privacidad SIN cuenta, y una redirección al login es motivo de
  // rechazo directo.
  '/software']

/**
 * Rutas que en el dominio de un cliente se sirven TAL CUAL, sin mandarlas al
 * CMS de páginas web.
 *
 * La web de un restaurante enlaza su carta y su portal de empleo (botones "Ver
 * carta digital" y "Trabaja con nosotros"), pero esas pantallas son módulos del
 * software, no páginas del CMS. Sin esta excepción, el rewrite las convertía en
 * `/sitio-publico/carta/...`, el resolvedor buscaba una página con ese slug, no la
 * encontraba y el visitante veía un 404 al pulsar el botón.
 */
const RUTAS_PUBLICAS_EN_DOMINIO_CLIENTE = [
  '/carta',
  '/empleo',
  '/reservar',
  '/formacion',
  '/documentacion',
  '/firmar',
]

function esRutaPublicaDeCliente(pathname: string) {
  return RUTAS_PUBLICAS_EN_DOMINIO_CLIENTE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

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

  const rawHost =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''

  // ── Subdominio de códigos QR ────────────────────────────────────────
  // `qr.balleshosteleros.com/a3k9` → `/q/a3k9`. Va ANTES del rewrite de dominios
  // custom porque termina en `.balleshosteleros.com` y `esHostPrincipal()` lo daría
  // por bueno, dejándolo caer en el enrutado normal de la app (login).
  //
  // El código corto vive en la raíz del subdominio a propósito: cada carácter de
  // más en la URL hace el QR más denso, con cuadros más pequeños, y peor de
  // escanear con la luz de un comedor por la noche.
  if (rawHost && esHostQr(rawHost)) {
    const pathname = request.nextUrl.pathname
    const esAsset =
      /\.[a-z0-9]+$/i.test(pathname) ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/api/')

    if (!esAsset && !pathname.startsWith('/q/')) {
      const codigo = pathname.replace(/^\/+|\/+$/g, '')
      const target = request.nextUrl.clone()
      // Sin código (alguien entra al subdominio a pelo) → aviso neutro, no login.
      target.pathname = codigo ? `/q/${codigo}` : '/q/_'
      return { response: NextResponse.rewrite(target), user: null }
    }
  }

  // ── Hostname rewrite: dominios custom de páginas web ────────────────
  if (rawHost && !esHostPrincipal(rawHost)) {
    const pathname = request.nextUrl.pathname
    const isAsset = /\.[a-z0-9]+$/i.test(pathname) || pathname.startsWith('/api/') || pathname.startsWith('/_next/')
    if (!isAsset && !esRutaPublicaDeCliente(pathname)) {
      const target = request.nextUrl.clone()
      target.pathname = `/sitio-publico${pathname === '/' ? '' : pathname}`
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // ── Sesión HUÉRFANA: cookies de un usuario que ya no existe ─────────
  // Si la cuenta se borró (o su token se revocó) mientras el móvil/PWA tenía
  // sesión guardada, GoTrue responde 403 "User from sub claim in JWT does not
  // exist" en CADA petición. Las cookies sb-* siguen en el dispositivo, así que
  // la app queda atascada: no entra y tampoco muestra el login, y el usuario
  // tiene que cerrar y reabrir la app a mano para desbloquearse.
  // Limpiamos aquí las cookies muertas para que se recupere sola.
  if (!user && userError) {
    const codigo = (userError as { code?: string }).code ?? ''
    const esSesionMuerta =
      userError.status === 403 ||
      codigo === 'user_not_found' ||
      /user.*not.*exist|user_not_found|session.*not.*found/i.test(
        userError.message ?? '',
      )
    if (esSesionMuerta) {
      const limpio = NextResponse.redirect(new URL('/?auth=1', request.url))
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-')) limpio.cookies.delete(c.name)
      }
      limpio.cookies.delete(SESION_INICIO_COOKIE)
      return { response: limpio, user: null }
    }
  }

  // Host demo: el formulario de demo debe mostrarse siempre en "/",
  // incluso si hay sesión activa. Así cada visitante empieza limpio.
  const normalizedHost = (rawHost || '').toLowerCase().split(':')[0]
  const isDemoHost =
    normalizedHost === 'demo.balleshosteleros.com' ||
    normalizedHost.startsWith('demo.')

  const pathname = request.nextUrl.pathname

  // ── Caducidad ABSOLUTA de sesión en ordenador (8h) ──────────────────
  // Solo desktop: el móvil/PWA mantiene la sesión. Se siembra una cookie con el
  // instante del login y, si han pasado 8h, cerramos sesión y devolvemos al
  // login. El móvil queda exento (rutas /m o user-agent móvil).
  // `sembrarInicioSesion` queda como nº (ms) a escribir en la cookie, o null si
  // no hay que sembrar. Se aplica a cualquier response que devolvamos abajo.
  let sembrarInicioSesion: number | null = null
  if (user) {
    const esMovil = esDispositivoMovil(request.headers.get('user-agent'), pathname)
    if (!esMovil) {
      const inicioCookie = request.cookies.get(SESION_INICIO_COOKIE)?.value
      const ahora = Date.now()
      if (sesionCaducada(inicioCookie, ahora)) {
        await supabase.auth.signOut()
        const url = new URL('/', request.url)
        url.searchParams.set('error', SESION_EXPIRADA_CODE)
        const res = NextResponse.redirect(url)
        res.cookies.delete(SESION_INICIO_COOKIE)
        return { response: res, user: null }
      }
      // Primera petición con sesión activa sin marca de inicio (login recién
      // hecho, sea por contraseña, Google o demo): sembramos el reloj de 8h.
      if (!inicioCookie) sembrarInicioSesion = ahora
    }
  }

  // Escribe la cookie de inicio de sesión (8h) en el response dado, si procede.
  const conInicioSesion = (res: NextResponse): NextResponse => {
    if (sembrarInicioSesion !== null) {
      res.cookies.set(SESION_INICIO_COOKIE, String(sembrarInicioSesion), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        // Sin maxAge propio: el corte lo decide el proxy comparando el
        // timestamp. Cookie de sesión del navegador.
      })
    }
    return res
  }

  // Rutas auth: callback, reset, etc. → libres
  // Rutas públicas: carta digital, sitios externos, assets, api → libres
  if (isAuthPath(pathname) || isPublicPath(pathname)) {
    // "/?logout=1" es la vuelta de un cierre de sesión: SIEMPRE muestra el login.
    // Si además quedara sesión viva (p.ej. la limpieza del servidor no llegó a
    // tiempo), aquí se remata borrando las cookies `sb-*` — que son `HttpOnly` y
    // el navegador no puede tocar. Sin esto la home rebotaba a la landing, la
    // landing a /m y /m de vuelta al login: el botón se quedaba girando sin fin.
    if (pathname === '/' && request.nextUrl.searchParams.has('logout')) {
      const limpio = conInicioSesion(supabaseResponse)
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-')) limpio.cookies.set(c.name, '', { path: '/', maxAge: 0 })
      }
      limpio.cookies.delete(SESION_INICIO_COOKIE)
      return { response: limpio, user: null }
    }

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
        response: conInicioSesion(NextResponse.redirect(new URL(LANDING_PATH, request.url))),
        user,
      }
    }
    return { response: conInicioSesion(supabaseResponse), user }
  }

  // Resto: privado → requiere sesión.
  //
  // El destino lleva `?auth=1` SIEMPRE, no solo desde /m: sin ese parámetro, la
  // regla móvil de `next.config.ts` devuelve "/" → "/m" por user-agent, y "/m"
  // vuelve aquí por falta de sesión. Rebote infinito.
  //
  // Es lo que dejaba la app instalada dando vueltas al abrirla tras cerrar
  // sesión: su `start_url` entra por una ruta privada, así que caía justo aquí.
  if (!user) {
    return {
      response: NextResponse.redirect(new URL('/?auth=1', request.url)),
      user: null,
    }
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

  return { response: conInicioSesion(supabaseResponse), user }
}
