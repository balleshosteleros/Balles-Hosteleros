'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Rol, PermisoModulo } from '@/features/ajustes/data/ajustes'
import { getRolContext } from '@/features/auth/actions/permisos-actions'
import { puedeEditarModulo, normalizarModulo } from '@/features/auth/lib/permisos'

const DEV_EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

// El nombre del rol coincide siempre con el del departamento (multi-tenant
// uniforme). El seed real de los 11 roles canónicos se hace por trigger en BD
// — esta función queda para casos donde se cree un departamento custom y se
// quiera el rol asociado con el mismo nombre.
function rolFromDepartamento(nombreDepto: string): string {
  return nombreDepto.trim().toUpperCase()
}

/**
 * Defensa server-side: quién puede mutar `empresa_roles`. Cierra el agujero de
 * "un usuario con UI bloqueada podría llamar al server action por POST y
 * reescribir su propio rol".
 *
 * Manda el permiso AJUSTES (editar) configurado en Ajustes → Roles, NO el flag
 * `es_admin_plataforma`: el rol concede, no la etiqueta de director. Antes esto
 * solo miraba el flag y ni consultaba los permisos, así que el toggle AJUSTES
 * de la pantalla de Roles no servía de nada.
 *
 * Devuelve mensaje de error si no está autorizado, null si OK.
 */
async function requireDirectorAppRole(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'No autenticado'

    const { permisos } = await getRolContext()
    if (!puedeEditarModulo(permisos, 'AJUSTES')) {
      return 'Sin permisos: necesitas Ajustes para modificar los roles de empresa'
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
        .from('usuario_empresas')
        .select('empresa_id')
        .eq('user_id', user.id)
        .eq('empresa_id', empresaIdParam)
        .maybeSingle()
      if (acceso) return empresaIdParam

      const { data: profile } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profile?.empresa_id === empresaIdParam) return empresaIdParam
      // El usuario pidió una empresa a la que no tiene acceso: silenciar y caer a la suya.
    }

    const { data: profile } = await supabase
      .from('usuarios')
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
    const authError = await requireDirectorAppRole()
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
    const authError = await requireDirectorAppRole()
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

/** Detecta si un id es un UUID real (rol persistido) frente a uno provisional de UI (`rol-<timestamp>`). */
function esUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/** Normaliza el nombre de rol para emparejar entre empresas del grupo (trim + upper). */
function normalizeRolNombre(nombre: string): string {
  return nombre.trim().toUpperCase()
}

/**
 * Empresas del GRUPO sobre las que se propaga la configuración de roles: todas
 * las que el director tiene accesibles (usuario_empresas) más su empresa
 * primaria. Los ROLES son del grupo entero, no por empresa: los mismos permisos
 * deben aplicar en todas las empresas del usuario. Ver
 * project_roles_por_grupo_no_por_empresa.
 */
async function empresasDelGrupoDelUsuario(empresaActual: string): Promise<string[]> {
  const ids = new Set<string>([empresaActual])
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return [...ids]

    const admin = createAdminClient()
    const { data: accesos } = await admin
      .from('usuario_empresas')
      .select('empresa_id')
      .eq('user_id', user.id)
    for (const a of accesos ?? []) ids.add(a.empresa_id as string)

    const { data: profile } = await admin
      .from('usuarios')
      .select('empresa_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profile?.empresa_id) ids.add(profile.empresa_id as string)
  } catch {
    // Ante cualquier fallo, degradar a solo la empresa actual (nunca menos).
  }
  return [...ids]
}

export async function saveRolesToSupabase(
  roles: Rol[],
  empresaIdParam?: string,
): Promise<{ error?: string }> {
  try {
    const authError = await requireDirectorAppRole()
    if (authError) return { error: authError }

    // RED ANTI-ENCIERRO: el rol de dirección NO puede quedarse sin AJUSTES.
    // Ahora que manda el permiso y no el flag `es_admin_plataforma`, apagar ese
    // toggle dejaría a la empresa sin nadie capaz de volver a tocar los roles:
    // la pantalla se abriría, pero guardar fallaría siempre y solo se podría
    // recuperar entrando a la base de datos a mano.
    const rolDireccion = roles.find(
      (r) => normalizeRolNombre(r.nombre) === normalizeRolNombre('DIRECCIÓN'),
    )
    if (rolDireccion) {
      const ajustes = rolDireccion.permisos?.find(
        (p) => normalizarModulo(p.modulo) === normalizarModulo('AJUSTES'),
      )
      if (!ajustes?.ver || !ajustes?.editar) {
        return {
          error:
            'No puedes quitarle Ajustes al rol DIRECCIÓN: nadie podría volver a configurar los roles.',
        }
      }
    }

    // Admin client por la misma razón que en loadRolesFromSupabase: la RLS
    // limita a la empresa primaria. La autorización ya se validó arriba
    // (sólo director) y `resolveEmpresaId` valida que la empresa elegida
    // sea accesible para el usuario.
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)

    // Los ROLES son del GRUPO, no por empresa: propagamos los permisos a TODAS
    // las empresas del director, emparejando por NOMBRE de rol. Así apagar un
    // toggle (p.ej. CÁMARAS de DIRECCIÓN) surte efecto en todas las empresas y
    // no divergen. NO tocamos ids ni asignaciones de usuarios de otras empresas:
    // solo actualizamos `permisos`/`descripcion` de los roles que YA existan
    // allí con el mismo nombre.
    const empresasGrupo = await empresasDelGrupoDelUsuario(empresa_id)
    const permisosPorNombre = new Map(
      roles.map((r) => [normalizeRolNombre(r.nombre), r]),
    )

    for (const emp of empresasGrupo) {
      const esEmpresaActual = emp === empresa_id

      // NO usamos delete-all + insert: `usuarios.rol_id` y otras tablas tienen FK
      // a `empresa_roles.id` con NO ACTION, así que borrar un rol con usuarios
      // asignados falla ("violates foreign key constraint usuarios_rol_id_fkey"),
      // y regenerar ids rompería las asignaciones existentes. En su lugar:
      // upsert por id (preservando ids reales) + borrado selectivo de los que
      // desaparecieron y no tienen usuarios.

      // 1) Roles existentes en BD para esta empresa (id + nombre).
      const { data: existentes, error: readError } = await admin
        .from('empresa_roles')
        .select('id, nombre')
        .eq('empresa_id', emp)
      if (readError) {
        if (esEmpresaActual) return { error: readError.message }
        continue // otra empresa del grupo: no bloquear el guardado principal
      }
      const idsEnBd = new Set((existentes ?? []).map((r) => r.id as string))

      let filas: Array<{ id: string; empresa_id: string; nombre: string; descripcion: string; permisos: PermisoModulo[] }>
      const idsEntrantes = new Set<string>()

      if (esEmpresaActual) {
        // Empresa actual: la UI es la fuente de verdad completa (crea/borra/renombra).
        filas = roles.map((r) => {
          const id = esUuid(r.id) ? r.id : crypto.randomUUID()
          idsEntrantes.add(id)
          return {
            id,
            empresa_id: emp,
            nombre: r.nombre,
            descripcion: r.descripcion,
            permisos: r.permisos,
          }
        })
      } else {
        // Otra empresa del grupo: solo actualizamos permisos/descr. de los roles
        // que YA existen allí con el mismo nombre. No creamos ni borramos: cada
        // empresa mantiene su propio conjunto de roles y sus asignaciones.
        filas = (existentes ?? [])
          .map((row) => {
            const match = permisosPorNombre.get(normalizeRolNombre(row.nombre as string))
            if (!match) return null
            idsEntrantes.add(row.id as string)
            return {
              id: row.id as string,
              empresa_id: emp,
              nombre: row.nombre as string,
              descripcion: match.descripcion,
              permisos: match.permisos,
            }
          })
          .filter((f): f is NonNullable<typeof f> => f !== null)
      }

      if (filas.length > 0) {
        const { error: upsertError } = await admin
          .from('empresa_roles')
          .upsert(filas, { onConflict: 'id' })
        if (upsertError && esEmpresaActual) return { error: upsertError.message }
      }

      // Borrado selectivo SOLO en la empresa actual (las demás no se tocan).
      if (esEmpresaActual) {
        const aBorrar = [...idsEnBd].filter((id) => !idsEntrantes.has(id))
        if (aBorrar.length > 0) {
          const { data: ocupados } = await admin
            .from('usuarios')
            .select('rol_id')
            .in('rol_id', aBorrar)
          const idsOcupados = new Set((ocupados ?? []).map((u) => u.rol_id as string))
          const borrables = aBorrar.filter((id) => !idsOcupados.has(id))
          if (borrables.length > 0) {
            const { error: deleteError } = await admin
              .from('empresa_roles')
              .delete()
              .eq('empresa_id', emp)
              .in('id', borrables)
            if (deleteError) return { error: deleteError.message }
          }
        }
      }
    }

    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

export async function loadRolesFromSupabase(
  empresaIdParam?: string,
): Promise<Rol[] | null> {
  try {
    // Usamos admin client porque la RLS de empresa_roles sólo permite leer la
    // empresa PRIMARIA del perfil, y el usuario puede estar viendo otra a la
    // que tiene acceso vía user_empresas. `resolveEmpresaId` ya valida ese
    // acceso, así que el bypass de RLS aquí es seguro.
    const admin = createAdminClient()
    const empresa_id = await resolveEmpresaId(empresaIdParam)

    const { data, error } = await admin
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
