import type { NextConfig } from 'next'

// UA regex para detección de móvil (PRP-045).
// Capturada como string porque next.config sólo permite strings en `has.value`.
// NOTA: iPad NO se incluye — tablet se considera desktop, igual que en src/shared/lib/device.ts
const MOBILE_UA_REGEX =
  '.*(iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone).*'

// Subdominio de códigos QR. Los QR se escanean desde móvil y su código vive en la
// raíz del subdominio, así que hay que excluirlo del redirect "/" → "/m": si no, el
// cliente acabaría en la app de empleados en vez de en la carta. Debe coincidir con
// `hostQr()` en hostname-resolver.ts.
const QR_HOST = process.env.NEXT_PUBLIC_QR_HOST?.trim() || 'qr.balleshosteleros.com'

// Web comercial del producto. Vive en este mismo proyecto bajo `/software`,
// pero en producción se publica en su propio subdominio.
const SOFTWARE_HOST =
  process.env.NEXT_PUBLIC_SOFTWARE_HOST?.trim() || 'software.balleshosteleros.com'

// Subdominios del dominio principal que sirven una PÁGINA WEB de empresa y no la
// app (p.ej. `bacanal.balleshosteleros.com`). Sirven para enseñar una web antes de
// apuntarle su dominio real, sin tocar el DNS de producción del cliente.
//
// Va AQUÍ y no solo en el proxy por lo mismo que el QR: "/" se sirve como página
// estática resuelta en el routing de Vercel, ANTES del middleware, así que el
// rewrite a `/sitio-publico` del proxy no llegaba a ejecutarse y salía la app (login).
// Debe coincidir con `hostsPreviewWeb()` en hostname-resolver.ts.
// Dominios REALES de las webs de empresa. Van en el código y no solo en la
// variable de entorno porque `/` se resuelve en el routing de Vercel ANTES del
// proxy: si el host no está aquí, Vercel sirve la app (login) y el rewrite a
// `/sitio-publico` nunca llega a ejecutarse. Un fallo de configuración dejaría
// la web pública del cliente enseñando el panel interno.
const WEB_HOSTS_FIJOS = [
  'bacanalmadrid.com',
  'www.bacanalmadrid.com',
  'grupohabana.es',
  'www.grupohabana.es',
]

const PREVIEW_WEB_HOSTS = Array.from(
  new Set(
    [...(process.env.PAGINAS_WEB_PREVIEW_HOSTS ?? '').split(','), ...WEB_HOSTS_FIJOS]
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  )
)

/**
 * Portales públicos que se sirven en el dominio del cliente sin su slug.
 *
 * POR QUÉ AQUÍ Y NO EN EL PROXY:
 * En producción los dominios de cliente los reescribe ESTE archivo, en el
 * routing de Vercel, que corre ANTES del proxy. Un rewrite puesto en el proxy
 * no llegaba a ejecutarse nunca y `/carta` acababa en un 404.
 *
 * El mapeo dominio→slug se resuelve en BUILD, una sola vez: en cada petición no
 * hay ninguna consulta. Como contrapartida, conectar un dominio nuevo entra con
 * el siguiente despliegue —- que es justo cuando Vercel activa su certificado.
 *
 * Si la consulta falla (BD caída durante el build), se devuelve lista vacía: la
 * web del cliente sigue funcionando y los portales siguen accesibles con su
 * slug, que es como estaban antes.
 */
const PORTALES = [
  { ruta: 'carta', campo: 'carta_slug' },
  { ruta: 'empleo', campo: 'empleo_slug' },
  { ruta: 'reservar', campo: 'slug' },
  { ruta: 'ticket', campo: 'slug' },
] as const

async function portalesSinSlug() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: doms } = await db
      .from('paginas_web_dominios')
      .select('hostname, pagina_id')
      .eq('estado', 'VERIFICADO')
    if (!doms?.length) return []

    const { data: pags } = await db
      .from('paginas_web')
      .select('id, empresa_id')
      .in('id', [...new Set(doms.map((d) => d.pagina_id))])
    if (!pags?.length) return []

    const empresaDePagina = new Map(pags.map((p) => [p.id, p.empresa_id]))

    const { data: emps } = await db
      .from('empresas')
      .select('id, carta_slug, empleo_slug, slug')
      .in('id', [...new Set(pags.map((p) => p.empresa_id))])
    if (!emps?.length) return []

    const empresaPorId = new Map(emps.map((e) => [e.id, e]))

    const reglas: Array<{
      source: string
      has: Array<{ type: 'host'; value: string }>
      destination: string
    }> = []

    for (const dom of doms) {
      const empresaId = empresaDePagina.get(dom.pagina_id)
      const empresa = empresaId ? empresaPorId.get(empresaId) : null
      if (!empresa) continue

      for (const portal of PORTALES) {
        const slug =
          (empresa as Record<string, string | null>)[portal.campo] ?? empresa.slug
        if (!slug) continue
        reglas.push({
          source: `/${portal.ruta}`,
          has: [{ type: 'host', value: dom.hostname }],
          destination: `/${portal.ruta}/${slug}`,
        })
      }
    }

    return reglas
  } catch (err) {
    console.error('[next.config] portalesSinSlug:', err)
    return []
  }
}

/**
 * Subdominios del software que sirven la web de un cliente, con el dominio
 * propio al que hay que mandarlos.
 *
 * Solo devuelve los que TIENEN dominio propio verificado: redirigir uno que no
 * lo tenga dejaría a ese restaurante sin web accesible.
 */
async function subdominiosSoftwareARedirigir() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: doms } = await db
      .from('paginas_web_dominios')
      .select('hostname, empresa_id')
      .eq('estado', 'VERIFICADO')
    if (!doms?.length) return []

    const porEmpresa = new Map<string, { software: string[]; propios: string[] }>()
    for (const d of doms) {
      const host = String(d.hostname ?? '').trim().toLowerCase()
      const empresaId = d.empresa_id as string | null
      if (!host || !empresaId) continue
      if (!porEmpresa.has(empresaId)) porEmpresa.set(empresaId, { software: [], propios: [] })
      const grupo = porEmpresa.get(empresaId)!
      if (host.endsWith('.balleshosteleros.com')) grupo.software.push(host)
      else grupo.propios.push(host)
    }

    const reglas: Array<{
      source: string
      has: Array<{ type: 'host'; value: string }>
      destination: string
      permanent: boolean
    }> = []

    for (const { software, propios } of porEmpresa.values()) {
      if (!software.length || !propios.length) continue
      const destinoHost = propios.find((h) => !h.startsWith('www.')) ?? propios[0]
      for (const host of software) {
        reglas.push({
          source: '/:ruta*',
          has: [{ type: 'host', value: host }],
          destination: `https://${destinoHost}/:ruta*`,
          permanent: true,
        })
      }
    }

    return reglas
  } catch (err) {
    console.error('[next.config] subdominiosSoftwareARedirigir:', err)
    return []
  }
}

const nextConfig: NextConfig = {
  // Probar la app desde el MÓVIL contra el localhost del Mac.
  //
  // En desarrollo, Next bloquea por seguridad las peticiones a sus recursos
  // internos (/_next/*) que no vengan de "localhost". Al abrir la app desde el
  // teléfono por la IP de la red (http://192.168.x.x:3000) ese bloqueo hacía
  // que la página entera respondiera 404 —- confuso, porque la ruta existía y
  // desde el Mac cargaba bien.
  //
  // Se autorizan los rangos privados enteros (no una IP fija) para que siga
  // funcionando cuando el router reasigne la dirección del Mac. Solo aplica a
  // `next dev`: en producción esta opción se ignora.
  allowedDevOrigins: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],

  // Versión del build horneada en el bundle del cliente. El auto-actualizador
  // de la PWA (VersionAutoUpdate) la compara contra /api/version para recargar
  // cuando hay un deploy nuevo, sin que el usuario reinstale nada.
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  },
  // Módulos nativos (bindings .node) que Turbopack no puede empaquetar en
  // chunks ESM: se cargan en runtime desde node_modules. `ssh2` lo arrastra
  // `ssh2-sftp-client`, usado solo en el cron server-only de canales-google-rwg.
  serverExternalPackages: ['ssh2', 'ssh2-sftp-client'],
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
    serverActions: {
      bodySizeLimit: '14mb',
    },
  },
  images: {
    remotePatterns: [
      // Supabase Storage: bucket carta-fotos (PRP-028 Carta Digital pública)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async rewrites() {
    return {
      // beforeFiles: se evalúa ANTES que las páginas existentes.
      //
      // Los subdominios de preview TIENEN que ir aquí: en `afterFiles` (el
      // array plano por defecto) el rewrite solo se aplica si la ruta no existe,
      // y "/" existe siempre —es la home de la app—, así que ganaba ella y el
      // subdominio seguía mostrando el login en vez de la web del restaurante.
      beforeFiles: [
        // Portales del software servidos en el dominio del cliente SIN repetir
        // su nombre: `bacanalmadrid.com/carta` en vez de `.../carta/bacanal`.
        // Esa es la URL que acaba impresa en el QR de la mesa.
        ...(await portalesSinSlug()),
        ...PREVIEW_WEB_HOSTS.flatMap((host) => [
          {
            source: '/',
            has: [{ type: 'host' as const, value: host }],
            destination: '/sitio-publico',
          },
          {
            // `carta|reservar|empleo|ticket` quedan FUERA: son portales del
            // software, no páginas del CMS. Los sirve `portalesSinSlug()` justo
            // arriba, que les pone el slug de la empresa dueña del dominio.
            source:
              '/:ruta((?!sitio-publico|_next/|api/|favicon|robots|sitemap|carta|reservar|empleo|ticket)[^/.]+)',
            has: [{ type: 'host' as const, value: host }],
            destination: '/sitio-publico/:ruta',
          },
        ]),
        // `software.balleshosteleros.com` sirve la landing integrada sin exponer
        // `/software` en la URL ni mantener un segundo proyecto de Vercel.
        //
        // Va en `beforeFiles` y NO en `afterFiles` por lo mismo que los hosts de
        // preview: en `afterFiles` el rewrite solo entra si la ruta no existe, y
        // "/" existe siempre —es el login—, así que ganaba el login y el
        // subdominio nunca llegaba a enseñar la landing.
        {
          source: '/',
          has: [{ type: 'host' as const, value: SOFTWARE_HOST }],
          destination: '/software',
        },
        // Documentos legales en la raíz: `/legal/privacidad` en vez de
        // `/software/legal/privacidad`.
        //
        // Estas URLs cortas son las que están escritas en la Google Auth
        // Platform (pantalla de consentimiento). El revisor las abre SIN cuenta,
        // y hasta ahora devolvían 404: motivo de rechazo directo. Al vivir aquí,
        // el panel de Google no hay que tocarlo.
        //
        // SIN filtro de host a propósito: los cuatro enlaces del pie del LOGIN
        // apuntan a `/legal/...` y el login se sirve desde el dominio de la app
        // (y desde localhost), no desde el subdominio comercial. Mientras el
        // rewrite exigía ese host, los cuatro daban 404 en la pantalla de
        // acceso, que es justo donde Google exige verlos.
        {
          source: '/legal/:documento(privacidad|terminos|cookies|aviso-legal)',
          destination: '/software/legal/:documento',
        },
      ],
      afterFiles: [
      // Subdominio de códigos QR: `qr.balleshosteleros.com/a3k9` → `/q/a3k9`.
      //
      // Va AQUÍ y no en el proxy porque los rewrites de next.config se aplican en
      // el routing de Vercel, antes del cache y antes del middleware. Haciéndolo
      // solo en el proxy, Vercel resolvía `/a3k9` como página inexistente y
      // devolvía un 404 (cacheado, además) sin llegar a ejecutar el rewrite.
      {
        source: '/:codigo((?!q/|_next/|api/|favicon|robots|sitemap)[^/.]+)',
        has: [{ type: 'host', value: QR_HOST }],
        destination: '/q/:codigo',
      },
      ],
    }
  },
  async redirects() {
    return [
      // Subdominios del SOFTWARE que servían la web de un cliente
      // (`bacanal.balleshosteleros.com`). Se cierran: mezclan la marca de la
      // gestora con la del restaurante en una URL pública, y además duplican en
      // Google el mismo contenido bajo dos dominios.
      //
      // Redirect permanente al dominio propio, no un 404: son las direcciones
      // que se usaron antes de conectar el dominio real, así que puede quedar
      // alguna pegada por ahí y tiene que acabar en el sitio bueno. El
      // permanente es también lo que hace que Google se quede solo con el
      // dominio del restaurante.
      ...(await subdominiosSoftwareARedirigir()),
      // Portales servidos en el dominio del CLIENTE con el nombre del local
      // repetido en la ruta (`bacanalmadrid.com/carta/bacanal`): sobra, porque
      // el dominio ya dice de qué local es. Se manda a la forma corta.
      //
      // Es un REDIRECT y no un borrado de la ruta: hay QR ya impresos y enlaces
      // publicados con la forma larga, y tienen que seguir llevando a su sitio.
      // La ruta `[slug]` se conserva viva por debajo —es la que sirve el rewrite
      // de `portalesSinSlug()` y la red de seguridad si la BD falla en un build.
      ...PREVIEW_WEB_HOSTS.flatMap((host) => [
        {
          source: '/:ruta(carta|reservar|empleo|ticket)/:slug',
          has: [{ type: 'host' as const, value: host }],
          destination: '/:ruta',
          permanent: false,
        },
        {
          source: '/:ruta(carta|reservar|empleo|ticket)/:slug/:resto+',
          has: [{ type: 'host' as const, value: host }],
          destination: '/:ruta/:resto+',
          permanent: false,
        },
      ]),
      // Raíz del subdominio de QR, sin código (alguien teclea el subdominio a
      // pelo): aviso neutro en vez de la pantalla de login del sistema.
      //
      // Es un REDIRECT y no un rewrite a propósito: "/" se sirve como home
      // estática y el rewrite se evaluaba tarde, dejando ver el login. Va el
      // primero de la lista para ganar al redirect móvil de PRP-045, que también
      // matchea "/".
      {
        source: '/',
        has: [{ type: 'host', value: QR_HOST }],
        destination: '/q/_',
        permanent: false,
      },
      // PRP-045: redirect móvil → /m para la home raíz, aplicado a nivel de
      // routing Vercel (antes de cache y middleware). El resto de rutas
      // privadas las protege el proxy.ts que sí se ejecuta una vez la home
      // pública deja de cachearse estáticamente.
      {
        source: '/',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        // "/?logout=1" (tras cerrar sesión), "/?auth=1" (sesión caducada / sin
        // sesión, desde la guardia de /m) y "/?error=..." (acceso rechazado por
        // el guard de perfil): NO redirigimos a /m (que exige sesión y rebotaría
        // a "/"), así el login —y su mensaje de error— es alcanzable en móvil.
        // Sin `error` aquí, el aviso "esta cuenta no tiene acceso" se perdía en
        // el rebote "/"→"/m"→"/?auth=1" y el usuario volvía al login en silencio.
        //
        // El host de QR queda FUERA de este redirect. Un QR se escanea casi
        // siempre desde un móvil, y en `qr.balleshosteleros.com` el código vive en
        // la raíz: sin esta exclusión, el cliente acabaría en la app móvil de
        // empleados en vez de en la carta, y fallaría prácticamente siempre.
        missing: [
          { type: 'query', key: 'logout' },
          { type: 'query', key: 'auth' },
          { type: 'query', key: 'error' },
          { type: 'host', value: QR_HOST },
          // Los subdominios de preview sirven la WEB del restaurante: /m es la
          // app de empleados y ahi no existe (404). Mismo caso que el host de QR.
          ...PREVIEW_WEB_HOSTS.map((h) => ({ type: 'host' as const, value: h })),
        ],
        destination: '/m',
        permanent: false,
      },
      {
        source: '/mi-panel',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        destination: '/m',
        permanent: false,
      },
      {
        source: '/mi-panel/:path*',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        destination: '/m',
        permanent: false,
      },
      {
        source: '/mis-departamentos',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        destination: '/m',
        permanent: false,
      },
      {
        source: '/mis-departamentos/:path*',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        destination: '/m',
        permanent: false,
      },
      // AJUSTES no se abre desde el teléfono: la configuración de la empresa
      // (usuarios, roles, permisos, empresas) se toca desde el ordenador.
      //
      // Se bloquea AQUÍ, por User-Agent real, y no escondiendo el botón con
      // CSS: `md:hidden` responde al ANCHO de ventana, así que ni tapa la URL
      // escrita a mano ni distingue un móvil de un portátil con la ventana
      // estrecha. Con el mismo patrón que /mi-panel y /mis-departamentos, un
      // móvil que pida /ajustes acaba en su app (Iván, 07-ago).
      {
        source: '/ajustes',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        destination: '/m',
        permanent: false,
      },
      {
        source: '/ajustes/:path*',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        destination: '/m',
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        // Portal público de empleo (PRP-034) — embebible vía iframe.
        // frame-ancestors abierto para que cada empresa pueda incrustar la URL en su web.
        source: '/empleo/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
      {
        // Reserva pública en modo embed (PRP-051) — sin chrome del portal.
        // Las rutas /reservar/[slug]/embed y /reservar/[slug]/[keyword]/embed
        // permiten incrustar el flujo en webs externas vía <iframe>.
        source: '/reservar/:path*/embed',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        source: '/ticket/:path*/embed',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        // PRP-045: la home pública NO se cachea para que el redirect móvil
        // pueda aplicarse con el User-Agent real en cada request.
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Vary', value: 'User-Agent' },
        ],
      },
      {
        // Documentación del candidato: NUNCA cachear, para que al recargar
        // siempre se cargue la última versión del formulario (sin tener que ir
        // a incógnito ni borrar caché).
        source: '/documentacion/:token*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
