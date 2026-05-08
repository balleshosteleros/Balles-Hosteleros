'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addRolEmpresa, deleteRolEmpresa } from '@/features/ajustes/actions/roles-actions'

const DEV_EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export type DepartamentoRow = {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string
  responsable_id: string | null
  estado: 'Activo' | 'Inactivo'
  area: 'OPERATIVA' | 'ADMINISTRATIVA'
  created_at: string
  updated_at: string
}

/**
 * Igual que en roles-actions: resuelve la empresa, validando que el usuario
 * tenga acceso (user_empresas) o que sea su empresa primaria. Si no se pasa
 * `empresaIdParam`, usa la primaria del perfil.
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

export async function listDepartamentos(empresaIdParam?: string): Promise<DepartamentoRow[]> {
  try {
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)
    const { data, error } = await admin
      .from('departamentos')
      .select('id, empresa_id, nombre, descripcion, responsable_id, estado, area, created_at, updated_at')
      .eq('empresa_id', empresa_id)
      .order('nombre', { ascending: true })
    if (error || !data) return []
    return data as DepartamentoRow[]
  } catch {
    return []
  }
}

export async function createDepartamento(input: {
  nombre: string
  descripcion?: string
  responsableId?: string | null
  estado?: 'Activo' | 'Inactivo'
  empresaId?: string
}): Promise<{ data?: DepartamentoRow; error?: string }> {
  try {
    const nombre = input.nombre.trim()
    if (!nombre) return { error: 'El nombre del departamento es obligatorio.' }
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(input.empresaId)

    const { data, error } = await admin
      .from('departamentos')
      .insert({
        empresa_id,
        nombre,
        descripcion: input.descripcion ?? '',
        responsable_id: input.responsableId ?? null,
        estado: input.estado ?? 'Activo',
      })
      .select('id, empresa_id, nombre, descripcion, responsable_id, estado, area, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === '23505') return { error: `Ya existe un departamento con el nombre "${nombre}".` }
      return { error: error.message }
    }

    // Crea (idempotente) el rol persona y lo enlaza al departamento por FK,
    // sobre la MISMA empresa que el departamento.
    await addRolEmpresa(nombre, data!.id as string, empresa_id)

    return { data: data as DepartamentoRow }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateDepartamento(
  id: string,
  patch: Partial<{ nombre: string; descripcion: string; responsableId: string | null; estado: 'Activo' | 'Inactivo'; empresaId: string }>,
): Promise<{ data?: DepartamentoRow; error?: string }> {
  try {
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(patch.empresaId)
    const update: Record<string, unknown> = {}
    if (patch.nombre !== undefined) update.nombre = patch.nombre.trim()
    if (patch.descripcion !== undefined) update.descripcion = patch.descripcion
    if (patch.responsableId !== undefined) update.responsable_id = patch.responsableId
    if (patch.estado !== undefined) update.estado = patch.estado

    const { data, error } = await admin
      .from('departamentos')
      .update(update)
      .eq('id', id)
      .eq('empresa_id', empresa_id)
      .select('id, empresa_id, nombre, descripcion, responsable_id, estado, area, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === '23505') return { error: 'Ya existe un departamento con ese nombre.' }
      return { error: error.message }
    }
    return { data: data as DepartamentoRow }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteDepartamento(
  id: string,
  empresaIdParam?: string,
): Promise<{ error?: string }> {
  try {
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)

    // Recupera nombre antes del delete para borrar el rol asociado.
    const { data: dep } = await admin
      .from('departamentos')
      .select('nombre')
      .eq('id', id)
      .eq('empresa_id', empresa_id)
      .single()

    const { error } = await admin
      .from('departamentos')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresa_id)

    if (error) return { error: error.message }
    if (dep?.nombre) await deleteRolEmpresa(dep.nombre as string, empresa_id)
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
