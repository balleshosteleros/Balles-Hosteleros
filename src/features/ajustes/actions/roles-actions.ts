'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Rol, PermisoModulo } from '@/features/ajustes/data/ajustes'

const DEV_EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

async function getEmpresaId(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return DEV_EMPRESA_ID

    const { data: profile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('user_id', user.id)
      .single()

    return profile?.empresa_id ?? DEV_EMPRESA_ID
  } catch {
    return DEV_EMPRESA_ID
  }
}

/**
 * Devuelve los nombres de los roles definidos en empresa_roles para la empresa actual.
 * Es la fuente de verdad del dropdown de "rol" en UsuariosTab.
 */
export async function getRolesEmpresaNombres(): Promise<string[]> {
  try {
    const admin = createAdminClient()
    const empresa_id = await getEmpresaId()
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
 * Añade un rol a empresa_roles si no existe ya con ese nombre (case-insensitive).
 * Lo usa DepartamentosTab al crear un departamento → rol homónimo automático.
 */
export async function addRolEmpresa(nombre: string): Promise<{ error?: string }> {
  try {
    const trimmed = nombre.trim()
    if (!trimmed) return { error: 'Nombre vacío' }
    const admin = createAdminClient()
    const empresa_id = await getEmpresaId()

    const { data: existentes } = await admin
      .from('empresa_roles')
      .select('id, nombre')
      .eq('empresa_id', empresa_id)
    const yaExiste = (existentes ?? []).some(
      (r) => (r.nombre as string).toLowerCase() === trimmed.toLowerCase()
    )
    if (yaExiste) return {}

    const { error } = await admin
      .from('empresa_roles')
      .insert({
        empresa_id,
        nombre: trimmed,
        descripcion: `Rol del departamento ${trimmed}`,
        permisos: [],
      })
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

/**
 * Elimina (si existe) el rol con ese nombre exacto en la empresa actual.
 * Lo usa DepartamentosTab al borrar un departamento.
 */
export async function deleteRolEmpresa(nombre: string): Promise<{ error?: string }> {
  try {
    const trimmed = nombre.trim()
    if (!trimmed) return {}
    const admin = createAdminClient()
    const empresa_id = await getEmpresaId()
    const { error } = await admin
      .from('empresa_roles')
      .delete()
      .eq('empresa_id', empresa_id)
      .ilike('nombre', trimmed)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

export async function saveRolesToSupabase(roles: Rol[]): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const empresa_id = await getEmpresaId()

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

export async function loadRolesFromSupabase(): Promise<Rol[] | null> {
  try {
    const supabase = await createClient()
    const empresa_id = await getEmpresaId()

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
