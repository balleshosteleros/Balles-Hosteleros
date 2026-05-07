'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PermisoModulo } from '@/features/ajustes/data/ajustes'

export interface UserPermisos {
  permisos: PermisoModulo[]
  rolLabel: string | null
  empresaId: string | null
  appRoles: string[]
}

export async function getUserPermisos(): Promise<UserPermisos> {
  const empty: UserPermisos = { permisos: [], rolLabel: null, empresaId: null, appRoles: [] }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return empty

    // Bypass local para el usuario de dirección
    if (user.email === 'REDACTED@local') {
      return {
        permisos: [], // El proxy ya le dará acceso total si tiene rol director
        rolLabel: 'Dirección',
        empresaId: '00000000-0000-0000-0000-000000000001',
        appRoles: ['director', 'admin'],
      }
    }

    const admin = createAdminClient()

    const [{ data: profile }, { data: rolesRows }] = await Promise.all([
      admin
        .from('profiles')
        .select('rol_label, empresa_id')
        .eq('user_id', user.id)
        .single(),
      admin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id),
    ])

    const appRoles = (rolesRows ?? []).map((r) => r.role as string)
    const empresaId = (profile?.empresa_id as string | null) ?? null
    const rolLabel = (profile?.rol_label as string | null) ?? null

    if (!empresaId || !rolLabel) {
      return { permisos: [], rolLabel, empresaId, appRoles }
    }

    const { data: rolRow } = await admin
      .from('empresa_roles')
      .select('permisos')
      .eq('empresa_id', empresaId)
      .ilike('nombre', rolLabel)
      .maybeSingle()

    return {
      permisos: ((rolRow?.permisos ?? []) as PermisoModulo[]),
      rolLabel,
      empresaId,
      appRoles,
    }
  } catch (e) {
    console.error('[getUserPermisos]', e)
    return empty
  }
}
