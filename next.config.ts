import type { NextConfig } from 'next'

// UA regex para detección de móvil (PRP-045).
// Capturada como string porque next.config sólo permite strings en `has.value`.
// NOTA: iPad NO se incluye — tablet se considera desktop, igual que en src/shared/lib/device.ts
const MOBILE_UA_REGEX =
  '.*(iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone).*'

const nextConfig: NextConfig = {
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
      // PRP-045: redirect móvil → /m a nivel de routing Vercel (antes del cache).
      // Excluye rutas que sí pueden verse en móvil: /m, auth, públicas, api, estáticos.
      {
        source:
          '/((?!m($|/)|login|signup|forgot-password|update-password|check-email|callback|acceso-demo|primer-acceso|carta|empleo|inspectores|firmar|r/|p/|v/|api/|__site|auth|_next|manifest\\.webmanifest|sw\\.js|robots\\.txt|sitemap\\.xml|favicon\\.ico|icons/|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif|woff2?|ttf|otf|js|css|map)).*)',
        has: [{ type: 'header', key: 'user-agent', value: MOBILE_UA_REGEX }],
        destination: '/m',
        permanent: false,
      },
      // Root explícito: cuando un móvil entra a "/", siempre va a /m.
      {
        source: '/',
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
