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
const PREVIEW_WEB_HOSTS = (process.env.PAGINAS_WEB_PREVIEW_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean)

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
      beforeFiles: PREVIEW_WEB_HOSTS.flatMap((host) => [
        {
          source: '/',
          has: [{ type: 'host' as const, value: host }],
          destination: '/sitio-publico',
        },
        {
          source: '/:ruta((?!sitio-publico|_next/|api/|favicon|robots|sitemap)[^/.]+)',
          has: [{ type: 'host' as const, value: host }],
          destination: '/sitio-publico/:ruta',
        },
      ]),
      afterFiles: [
      // `software.balleshosteleros.com` sirve la landing integrada sin exponer
      // `/software` en la URL ni mantener un segundo proyecto de Vercel.
      {
        source: '/',
        has: [{ type: 'host', value: SOFTWARE_HOST }],
        destination: '/software',
      },
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
        source: '/reservar/:slug/embed',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        source: '/reservar/:slug/:keyword/embed',
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
