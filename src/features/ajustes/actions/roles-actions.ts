'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Rol, PermisoModulo } from '@/features/ajustes/data/ajustes'

const DEV_EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

// Mapping departamento → nombre del rol responsable (forma persona).
// El nombre del departamento se mantiene; el rol auto-creado adopta el cargo.
// Si un departamento no está en el mapa, el rol toma el mismo nombre del dpto.
const DEPT_TO_ROLE: Record<string, string> = {
  'GERENCIA': 'GERENTE',
  'CONTABILIDAD': 'CONTABLE',
  'GESTORÍA': 'GESTOR',
  'GESTORIA': 'GESTOR',
  'JURÍDICO': 'ABOGADO',
  'JURIDICO': 'ABOGADO',
  'RECURSOS HUMANOS': 'RESPONSABLE RRHH',
  'RRHH': 'RESPONSABLE RRHH',
  'LOGÍSTICA': 'JEFE DE LOGÍSTICA',
  'LOGISTICA': 'JEFE DE LOGÍSTICA',
  'MARKETING': 'RESPONSABLE MARKETING',
  'COCINA': 'JEFE DE COCINA',
  'SALA': 'JEFE DE SALA',
  'CALIDAD': 'RESPONSABLE CALIDAD',
  'DIRECCIÓN': 'DIRECTOR',
  'DIRECCION': 'DIRECTOR',
}

function rolFromDepartamento(nombreDepto: string): string {
  const key = nombreDepto.trim().toUpperCase()
  return DEPT_TO_ROLE[key] ?? nombreDepto.trim()
}

/**
 * Defensa server-side: solo usuarios con app_role 'admin' pueden mutar
 * `empresa_roles`. Cierra el agujero de "un Director con UI bloqueada
 * podría llamar al server action por POST y reescribir su propio rol".
 * Devuelve mensaje de error si no está autorizado, null si OK.
 */
async function requireAdminAppRole(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'No autenticado'

    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    const roles = (rows ?? []).map((r) => r.role as string)
    if (!roles.includes('admin')) {
      return 'Solo un administrador puede modificar roles de empresa'
    }
    return null
  } catch (e) {
    return `Error verificando autorización: ${String(e)}`
  }
}

/**
 * Resuelve la empresa sobre la que opera la acción.
 * - Si llega `empresaIdParam` se valida que el usuario tenga acceso (user_empresas)
 *   o que sea su empresa primaria (profiles.empresa_id) — ambos casos son válidos.
 * - Si no llega, cae a la empresa primaria del perfil.
 * - Si nada de lo anterior funciona, DEV_EMPRESA_ID (entorno sin sesión).
 */
async function resolveEmpresaId(empresaIdParam?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return empresaIdParam ?? DEV_EMPRESA_ID

    if (empresaIdParam) {
      const { data: acceso } = await supabase
        .from('user_empresas')
        .select('empresa_id')
        .eq('user_id', user.id)
        .eq('empresa_id', empresaIdParam)
        .maybeSingle()
      if (acceso) return empresaIdParam

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profile?.empresa_id === empresaIdParam) return empresaIdParam
      // El usuario pidió una empresa a la que no tiene acceso: silenciar y caer a la suya.
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('user_id', user.id)
      .single()

    return profile?.empresa_id ?? DEV_EMPRESA_ID
  } catch {
    return empresaIdParam ?? DEV_EMPRESA_ID
  }
}

/**
 * Devuelve los nombres de los roles definidos en empresa_roles para la empresa indicada.
 * Es la fuente de verdad del dropdown de "rol" en UsuariosTab.
 */
export async function getRolesEmpresaNombres(empresaIdParam?: string): Promise<string[]> {
  try {
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)
    const { data, error } = await admin
      .from('empresa_roles')
      .select('nombre')
      .eq('empresa_id', empresa_id)
      .order('created_at', { ascending: true })
    if (error || !data) return []
    return data.map((r) => (r.nombre as string)).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Añade un rol a empresa_roles a partir de un nombre de departamento.
 * El rol se nombra en forma persona (DEPT_TO_ROLE), no como el departamento.
 * Si se provee departamentoId, queda enlazado por FK (empresa_roles.departamento_id).
 * Idempotente por nombre case-insensitive (si ya existe, actualiza el FK si falta).
 */
export async function addRolEmpresa(
  nombreDepartamento: string,
  departamentoId?: string,
  empresaIdParam?: string,
): Promise<{ error?: string }> {
  try {
    const authError = await requireAdminAppRole()
    if (authError) return { error: authError }

    const dpto = nombreDepartamento.trim()
    if (!dpto) return { error: 'Nombre vacío' }
    const rolNombre = rolFromDepartamento(dpto)
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)

    const { data: existente } = await admin
      .from('empresa_roles')
      .select('id, departamento_id')
      .eq('empresa_id', empresa_id)
      .ilike('nombre', rolNombre)
      .maybeSingle()

    if (existente) {
      // Si tenemos departamentoId y el rol existente no lo tiene, completamos el FK.
      if (departamentoId && !existente.departamento_id) {
        await admin
          .from('empresa_roles')
          .update({ departamento_id: departamentoId })
          .eq('id', existente.id as string)
      }
      return {}
    }

    // Permisos sembrados: el rol sólo ve/edita su propio módulo (= dpto en uppercase).
    // El usuario puede modificarlos después en la pestaña Roles.
    const moduloPropio = dpto.toUpperCase()
    const permisosSeed = [{ modulo: moduloPropio, ver: true, editar: true }]

    const { error } = await admin
      .from('empresa_roles')
      .insert({
        empresa_id,
        nombre: rolNombre,
        descripcion: `Rol responsable del departamento ${dpto}`,
        permisos: permisosSeed,
        departamento_id: departamentoId ?? null,
      })
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

/**
 * Elimina el rol asociado a un departamento (mapea a forma persona vía DEPT_TO_ROLE).
 * Lo usa DepartamentosTab al borrar un departamento.
 */
export async function deleteRolEmpresa(
  nombreDepartamento: string,
  empresaIdParam?: string,
): Promise<{ error?: string }> {
  try {
    const authError = await requireAdminAppRole()
    if (authError) return { error: authError }

    const dpto = nombreDepartamento.trim()
    if (!dpto) return {}
    const rolNombre = rolFromDepartamento(dpto)
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)
    const { error } = await admin
      .from('empresa_roles')
      .delete()
      .eq('empresa_id', empresa_id)
      .ilike('nombre', rolNombre)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

export async function saveRolesToSupabase(
  roles: Rol[],
  empresaIdParam?: string,
): Promise<{ error?: string }> {
  try {
    const authError = await requireAdminAppRole()
    if (authError) return { error: authError }

    const supabase = await createClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)

    // Borrar todos los roles actuales de la empresa
    const { error: deleteError } = await supabase
      .from('empresa_roles')
      .delete()
      .eq('empresa_id', empresa_id)

    if (deleteError) return { error: deleteError.message }

    if (roles.length === 0) return {}

    // Insertar todos los roles actuales
    const { error: insertError } = await supabase
      .from('empresa_roles')
      .insert(
        roles.map((r) => ({
          empresa_id,
          nombre: r.nombre,
          descripcion: r.descripcion,
          permisos: r.permisos,
        }))
      )

    if (insertError) return { error: insertError.message }
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

export async function loadRolesFromSupabase(
  empresaIdParam?: string,
): Promise<Rol[] | null> {
  try {
    const supabase = await createClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)

    const { data, error } = await supabase
      .from('empresa_roles')
      .select('id, nombre, descripcion, permisos')
      .eq('empresa_id', empresa_id)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) return null

    return data.map((row) => ({
      id: row.id as string,
      nombre: row.nombre as string,
      descripcion: row.descripcion as string,
      permisos: (row.permisos ?? []) as PermisoModulo[],
    }))
  } catch {
    return null
  }
}
