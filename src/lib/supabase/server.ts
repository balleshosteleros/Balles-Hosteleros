import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function createClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // Empresa activa (selector) → cabecera `x-bh-empresa`. Con ella, la RLS
  // (`empresas_del_usuario()`) deja de autorizar TODAS las empresas del usuario
  // y autoriza SOLO la que está viendo: el aislamiento deja de depender de que
  // cada consulta se acuerde de filtrar por `empresa_id`.
  const empresaActiva = cookieStore.get('bh_empresa_activa')?.value
  const empresaHeader =
    empresaActiva && UUID_RE.test(empresaActiva)
      ? { 'x-bh-empresa': empresaActiva }
      : undefined

  return createServerClient(
    url,
    key,
    {
      ...(empresaHeader ? { global: { headers: empresaHeader } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          } catch {
            // Ignore en Server Components
          }
        },
      },
    }
  )
}

/**
 * Usuario autenticado, resuelto UNA sola vez por petición.
 *
 * `auth.getUser()` valida el token contra el servidor de Supabase, así que es
 * un viaje de red cada vez que se llama. Abrir una ficha lanza varias acciones
 * en paralelo —actividad, etiquetas, cobros— y cada una lo repetía por su
 * cuenta: los viajes se sumaban y la ficha se quedaba en "Cargando…" durante
 * decenas de segundos. `cache` de React comparte el resultado dentro de la
 * misma petición, sin guardar nada entre peticiones ni entre usuarios.
 */
export const getUsuarioActual = cache(async function getUsuarioActual() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
