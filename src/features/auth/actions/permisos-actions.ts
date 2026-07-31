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

export async function getRolContext(targetUserId?: string, accessToken?: string): Promise<RolContext> {
  const vacio: RolContext = {
    rolId: null, rolNombre: null, permisos: [], esDirector: false, empresaId: null, departamento: null,
  }
  try {
    let userId = targetUserId
    if (!userId) {
      const supabase = await createClient()
      // Si el cliente pasa su `access_token`, lo validamos directamente contra el
      // servidor de auth (no se puede falsificar). Así NO dependemos de que las
      // cookies de sesión estén propagadas — la causa de la carrera tras el login
      // que dejaba el dashboard en "No tienes departamentos" con un backoff lento.
      const { data: { user } } = accessToken
        ? await supabase.auth.getUser(accessToken)
        : await supabase.auth.getUser()
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

/**
 * Nombres de rol (empresa_roles.nombre) que, sin ser admin de plataforma,
 * tienen acceso a la vista "Mis Departamentos" y al conmutador del header.
 * Se compara normalizado (sin acentos, mayúsculas, sin espacios).
 */
const ROLES_ACCESO_DEPARTAMENTOS = new Set(['GERENCIA'])
const COMBINING_MARKS = /[̀-ͯ]/g
function normalizarRol(nombre: string): string {
  return nombre.normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase().trim()
}

export async function getUserPermisos(accessToken?: string): Promise<UserPermisos> {
  const ctx = await getRolContext(undefined, accessToken)
  // `appRoles` se deriva del flag de plataforma (paridad con usuario_roles, que
  // solo tenía director/empleado). Los lectores comprueban includes('director').
  // Gerencia NO es admin de plataforma (esDirector=false) pero sí necesita el
  // conmutador "Mis Paneles / Mis Departamentos": propagamos su rol real además
  // de 'empleado' para que la UI (que filtra por permisos vía puedeVer) lo trate
  // como acceso a departamentos sin darle el bypass total de dirección.
  const appRoles = ctx.esDirector
    ? ['director']
    : ctx.rolNombre && ROLES_ACCESO_DEPARTAMENTOS.has(normalizarRol(ctx.rolNombre))
      ? ['gerencia', 'empleado']
      : ['empleado']
  return {
    permisos: ctx.permisos,
    rolLabel: ctx.rolNombre,
    empresaId: ctx.empresaId,
    appRoles,
    departamento: ctx.departamento,
  }
}
