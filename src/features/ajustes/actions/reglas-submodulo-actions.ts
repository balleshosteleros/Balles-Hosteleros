'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  REGLA_MODULO_SENTINEL,
  type ModoReglas,
  type ReglaSubmoduloRow,
} from '@/features/ajustes/lib/reglas-submodulos-catalogo'

const DEV_EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

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

/** Lista todas las reglas guardadas (módulo y submódulo) de la empresa. */
export async function listReglasSubmodulo(empresaIdParam?: string): Promise<ReglaSubmoduloRow[]> {
  try {
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)
    const { data, error } = await admin
      .from('empresa_reglas_submodulo')
      .select('id, empresa_id, modulo, submodulo, modo, campos_obligatorios, created_at, updated_at')
      .eq('empresa_id', empresa_id)
    if (error || !data) return []
    return data as ReglaSubmoduloRow[]
  } catch {
    return []
  }
}

/** Devuelve la regla de un módulo o submódulo concreto. */
export async function getReglaSubmodulo(
  modulo: string,
  submodulo: string,
  empresaIdParam?: string,
): Promise<ReglaSubmoduloRow | null> {
  try {
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)
    const { data, error } = await admin
      .from('empresa_reglas_submodulo')
      .select('id, empresa_id, modulo, submodulo, modo, campos_obligatorios, created_at, updated_at')
      .eq('empresa_id', empresa_id)
      .eq('modulo', modulo)
      .eq('submodulo', submodulo)
      .maybeSingle()
    if (error || !data) return null
    return data as ReglaSubmoduloRow
  } catch {
    return null
  }
}

/** Devuelve la regla a nivel MÓDULO (centinela '*'). */
export async function getReglaModulo(
  modulo: string,
  empresaIdParam?: string,
): Promise<ReglaSubmoduloRow | null> {
  return getReglaSubmodulo(modulo, REGLA_MODULO_SENTINEL, empresaIdParam)
}

/** Upsert de una regla (vale para módulo o submódulo). */
export async function upsertReglaSubmodulo(input: {
  modulo: string
  submodulo: string
  modo: ModoReglas
  camposObligatorios: string[]
  empresaId?: string
}): Promise<{ data?: ReglaSubmoduloRow; error?: string }> {
  try {
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(input.empresaId)

    const esModulo = input.submodulo === REGLA_MODULO_SENTINEL
    const camposParaGuardar =
      input.modo === 'personalizado' && !esModulo ? input.camposObligatorios : []

    const { data, error } = await admin
      .from('empresa_reglas_submodulo')
      .upsert(
        {
          empresa_id,
          modulo: input.modulo,
          submodulo: input.submodulo,
          modo: input.modo,
          campos_obligatorios: camposParaGuardar,
        },
        { onConflict: 'empresa_id,modulo,submodulo' },
      )
      .select('id, empresa_id, modulo, submodulo, modo, campos_obligatorios, created_at, updated_at')
      .single()

    if (error) return { error: error.message }
    return { data: data as ReglaSubmoduloRow }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Conveniencia: upsert a nivel módulo. */
export async function upsertReglaModulo(input: {
  modulo: string
  modo: ModoReglas
  empresaId?: string
}): Promise<{ data?: ReglaSubmoduloRow; error?: string }> {
  return upsertReglaSubmodulo({
    modulo: input.modulo,
    submodulo: REGLA_MODULO_SENTINEL,
    modo: input.modo,
    camposObligatorios: [],
    empresaId: input.empresaId,
  })
}
