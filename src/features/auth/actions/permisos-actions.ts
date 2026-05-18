'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PermisoModulo } from '@/features/ajustes/data/ajustes'

export interface UserPermisos {
  permisos: PermisoModulo[]
  rolLabel: string | null
  empresaId: string | null
  appRoles: string[]
  /**
   * Departamento al que está asignado el empleado (`profiles.departamento`).
   * Es un string libre con el nombre del departamento (mismo nombre que en
   * `departamentos.nombre` cuando el dato es coherente). `null` si el
   * empleado no tiene ningún departamento asignado.
   */
  departamento: string | null
}

export async function getUserPermisos(): Promise<UserPermisos> {
  const empty: UserPermisos = { permisos: [], rolLabel: null, empresaId: null, appRoles: [], departamento: null }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return empty

    const admin = createAdminClient()

    const [{ data: profile }, { data: rolesRows }] = await Promise.all([
      admin
        .from('profiles')
        .select('rol_label, empresa_id, departamento')
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
    const departamento = ((profile?.departamento as string | null) ?? null) || null

    if (!empresaId || !rolLabel) {
      return { permisos: [], rolLabel, empresaId, appRoles, departamento }
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
      departamento,
    }
  } catch (e) {
    console.error('[getUserPermisos]', e)
    return empty
  }
}
