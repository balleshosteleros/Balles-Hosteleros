import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmpresaActivaCliente } from '@/lib/supabase/empresa-activa-cliente'

// Singleton del browser client. `createBrowserClient` está pensado para
// instanciarse una sola vez por pestaña: cada instancia gestiona su propio
// auto-refresh de tokens y suscripciones, y tener varias en paralelo provoca
// que algunas queries se ejecuten contra una instancia sin sesión hidratada
// (RLS bloquea silenciosamente y devuelve `null`).
let _client: SupabaseClient | null = null

export function createClient() {
  if (typeof window !== 'undefined' && _client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !key) {
    if (typeof window !== 'undefined') {
      console.error(
        'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project settings.'
      )
    }
    const fallback = createBrowserClient(
      url || 'https://placeholder.supabase.co',
      key || 'placeholder-anon-key'
    )
    if (typeof window !== 'undefined') _client = fallback
    return fallback
  }

  // La empresa activa viaja en cada consulta (`x-bh-empresa`) para que la RLS
  // autorice SOLO esa empresa y no todas las del usuario. Se lee en cada
  // petición (no al crear el cliente) porque el cliente es un singleton por
  // pestaña y la empresa puede cambiar sin recargar.
  const client = createBrowserClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const empresaId = getEmpresaActivaCliente()
        if (!empresaId) return fetch(input, init)
        const headers = new Headers(init?.headers)
        headers.set('x-bh-empresa', empresaId)
        return fetch(input, { ...init, headers })
      },
    },
  })
  if (typeof window !== 'undefined') _client = client
  return client
}
