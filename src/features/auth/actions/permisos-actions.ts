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

/**
 * Contexto de rol de un usuario — FUENTE ÚNICA DE VERDAD (PRP-063).
 *
 * Resuelve el rol leyendo SOLO `usuarios.rol_id → empresa_roles` (enlace por ID,
 * no por texto). Devuelve nombre, permisos y si es director (super-usuario de
 * plataforma) DERIVADO de `empresa_roles.es_admin_plataforma`. Sin argumento,
 * usa el usuario de la sesión.
 */
export interface RolContext {
  rolId: string | null
  rolNombre: string | null
  permisos: PermisoModulo[]
  esDirector: boolean
  empresaId: string | null
  departamento: string | null
}

export async function getRolContext(targetUserId?: string): Promise<RolContext> {
  const vacio: RolContext = {
    rolId: null, rolNombre: null, permisos: [], esDirector: false, empresaId: null, departamento: null,
  }
  try {
    let userId = targetUserId
    if (!userId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return vacio
      userId = user.id
    }

    const admin = createAdminClient()
    const { data: u } = await admin
      .from('usuarios')
      .select('rol_id, empresa_id, departamento, rol_label')
      .eq('user_id', userId)
      .maybeSingle()
    if (!u) return vacio

    const empresaId = (u.empresa_id as string | null) ?? null
    const departamento = ((u.departamento as string | null) ?? null) || null

    if (!u.rol_id) {
      // Defensivo: sin rol_id (no debería pasar tras el backfill de Fase 2).
      return { ...vacio, empresaId, departamento, rolNombre: (u.rol_label as string | null) ?? null }
    }

    const { data: rol } = await admin
      .from('empresa_roles')
      .select('id, nombre, permisos, es_admin_plataforma')
      .eq('id', u.rol_id as string)
      .maybeSingle()
    if (!rol) return { ...vacio, empresaId, departamento }

    return {
      rolId: rol.id as string,
      rolNombre: (rol.nombre as string) ?? null,
      permisos: ((rol.permisos ?? []) as PermisoModulo[]),
      esDirector: Boolean(rol.es_admin_plataforma),
      empresaId,
      departamento,
    }
  } catch (e) {
    console.error('[getRolContext]', e)
    return vacio
  }
}

export async function getUserPermisos(): Promise<UserPermisos> {
  const ctx = await getRolContext()
  // `appRoles` se deriva del flag de plataforma (paridad con usuario_roles, que
  // solo tenía director/empleado). Los lectores comprueban includes('director').
  const appRoles = ctx.esDirector ? ['director'] : ['empleado']
  return {
    permisos: ctx.permisos,
    rolLabel: ctx.rolNombre,
    empresaId: ctx.empresaId,
    appRoles,
    departamento: ctx.departamento,
  }
}
