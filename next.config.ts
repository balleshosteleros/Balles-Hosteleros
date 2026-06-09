import type { NextConfig } from 'next'

// UA regex para detección de móvil (PRP-045).
// Capturada como string porque next.config sólo permite strings en `has.value`.
// NOTA: iPad NO se incluye — tablet se considera desktop, igual que en src/shared/lib/device.ts
const MOBILE_UA_REGEX =
  '.*(iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone).*'

const nextConfig: NextConfig = {
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
  async redirects() {
    return [
      // PRP-045: redirect móvil → /m para la home raíz, aplicado a nivel de
      // routing Vercel (antes de cache y middleware). El resto de rutas
      // privadas las protege el proxy.ts que sí se ejecuta una vez la home
      // pública deja de cachearse estáticamente.
      {
        source: '/',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        // "/?logout=1" (tras cerrar sesión) y "/?auth=1" (sesión caducada / sin
        // sesión, desde la guardia de /m): NO redirigimos a /m (que exige sesión
        // y rebotaría a "/"), así el login es alcanzable en móvil.
        missing: [
          { type: 'query', key: 'logout' },
          { type: 'query', key: 'auth' },
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
    ]
  },
}

export default nextConfig
