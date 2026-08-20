'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capitalizeText } from '@/shared/lib/utils'
import { sendEmail } from '@/lib/email/send'
import { passwordResetEmail } from '@/lib/email/templates/password-reset'
import { buildRecoveryActionUrl } from '@/lib/auth/recovery-link'
import { getSiteUrl } from '@/lib/site-url'
import { friendlyError } from '@/shared/lib/friendly-errors'
import { getRolContext } from '@/features/auth/actions/permisos-actions'
import { puedeVerModulo, puedeEditarModulo } from '@/features/auth/lib/permisos'

/**
 * Verifica que el nombre de rol exista en empresa_roles para la empresa del usuario.
 * El dropdown de la UI solo muestra estos roles; esto es la defensa server-side.
 */
async function assertRoleExistsInEmpresa(
  admin: ReturnType<typeof createAdminClient>,
  empresaId: string,
  rolLabel: string,
): Promise<{ error?: string }> {
  const { data, error } = await admin
    .from('empresa_roles')
    .select('nombre')
    .eq('empresa_id', empresaId)
    .ilike('nombre', rolLabel.trim())
    .limit(1)
    .maybeSingle()
  if (error) return { error: `Error validando rol: ${friendlyError(error)}` }
  if (!data) return { error: `El rol "${rolLabel}" no existe en empresa_roles. Créalo primero en la pestaña Roles.` }
  return {}
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // Manda el permiso AJUSTES (editar) de Ajustes → Roles, no el flag de
  // director: gestionar cuentas de acceso es administrar el sistema. Antes esto
  // solo miraba `es_admin_plataforma` e ignoraba los permisos del rol.
  const { permisos } = await getRolContext(user.id)
  if (!puedeEditarModulo(permisos, 'AJUSTES')) {
    throw new Error('Sin permisos: necesitas Ajustes para gestionar usuarios')
  }

  return user
}

/** Variante de LECTURA: consultar la administración exige AJUSTES (ver). */
async function requireAjustesLectura() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { permisos } = await getRolContext(user.id)
  if (!puedeVerModulo(permisos, 'AJUSTES')) {
    throw new Error('Sin permisos: necesitas Ajustes para ver los usuarios')
  }

  return user
}

// Política de la contraseña MANUAL (la que fija el admin desde Ajustes).
// A diferencia del alta por correo (PIN de 6 dígitos exactos, ver
// updatePassword en actions/auth.ts), aquí el admin elige una contraseña real.
// Regla razonable "de lo típico": mínimo 8, máximo 72 (límite de bcrypt: por
// encima Supabase Auth ignora los caracteres extra), y que mezcle al menos una
// letra y un número. Sin exigir mayúsculas/símbolos: longitud > reglas raras.
const PASSWORD_MIN_LEN = 8
const PASSWORD_MAX_LEN = 72
const PASSWORD_ERROR =
  'La contraseña debe tener entre 8 y 72 caracteres e incluir al menos una letra y un número.'

/** Valida la contraseña manual del admin. Devuelve mensaje de error o null. */
function validateManualPassword(password: string): string | null {
  const pw = password ?? ''
  if (pw.length < PASSWORD_MIN_LEN || pw.length > PASSWORD_MAX_LEN) return PASSWORD_ERROR
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return PASSWORD_ERROR
  return null
}

export async function createEmployee(formData: FormData) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const pwError = validateManualPassword(password)
  if (pwError) return { error: pwError }
  const nombre = capitalizeText((formData.get('nombre') as string) ?? '')
  const apellidos = capitalizeText((formData.get('apellidos') as string) ?? '')
  const fullName = [nombre, apellidos].filter(Boolean).join(' ')
  // El campo "role" del form ahora contiene el NOMBRE del rol custom (ej "Jefe Cocina").
  // Lo guardamos tal cual en profiles.rol_label, e inferimos el app_role para user_roles.
  const rolLabelInput = ((formData.get('role') as string) ?? '').trim()
  if (!rolLabelInput) return { error: 'Debes seleccionar un rol.' }

  // Validar que el rol exista en empresa_roles del invocador.
  const supabase = await createClient()
  const { data: { user: invoker } } = await supabase.auth.getUser()
  const { data: invokerProfile } = invoker
    ? await admin.from('usuarios').select('empresa_id').eq('user_id', invoker.id).maybeSingle()
    : { data: null }
  const empresaId = invokerProfile?.empresa_id
  if (!empresaId) return { error: 'No se pudo determinar la empresa del invocador.' }
  const validation = await assertRoleExistsInEmpresa(admin, empresaId, rolLabelInput)
  if (validation.error) return { error: validation.error }

  // Fuente única (PRP-063): el usuario se enlaza por rol_id (no por texto).
  const { data: rolRowAlta } = await admin
    .from('empresa_roles')
    .select('id')
    .eq('empresa_id', empresaId)
    .ilike('nombre', rolLabelInput)
    .maybeSingle()
  const rolId = (rolRowAlta?.id as string | null) ?? null

  const rolLabel = rolLabelInput
  // El departamento ya no se asigna a nivel de usuario: se hereda del rol.
  const departamento = ((formData.get('departamento') as string) ?? '').trim().toUpperCase() || null
  // Flag de empleado: true por defecto. La UI envía "1" o "0".
  // Si no llega el campo (compatibilidad con clientes viejos), se asume empleado.
  const esEmpleadoRaw = formData.get('es_empleado')
  const esEmpleado = esEmpleadoRaw == null ? true : String(esEmpleadoRaw) !== '0'

  // Crear usuario en auth (el trigger handle_new_user crea el profile automáticamente)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) return { error: friendlyError(error) }

  // Completar empresa + nombre + (departamento opcional) + rol_label en el profile.
  // avatar_obligatorio=true solo para empleados → fuerza la foto en primer login.
  // empresa_id se asigna aquí (el trigger handle_new_user ya no la pone por
  // defecto — solo crea la fila base del profile).
  const profilePatch: Record<string, string | boolean | null> = {
    empresa_id: empresaId,
    full_name: fullName,
    nombre,
    apellidos,
    rol_label: rolLabel,
    rol_id: rolId,
    es_empleado: esEmpleado,
    avatar_obligatorio: esEmpleado,
    // Alta manual desde Ajustes: el admin fija una contraseña real (no la
    // aleatoria del alta de empleados), así que NO se le obliga a reelegirla.
    password_set: true,
  }
  if (departamento) profilePatch.departamento = departamento

  const { error: profileError } = await admin
    .from('usuarios')
    .update(profilePatch)
    .eq('id', data.user.id)

  if (profileError) return { error: friendlyError(profileError) }

  // El rol se enlaza por usuarios.rol_id (fijado arriba en el profilePatch);
  // la tabla legacy usuario_roles ya no se usa (fuente única PRP-063).

  // Asignar empresas a las que el usuario tendrá acceso (multi-empresa).
  // El cliente envía 0..N campos `empresa_ids`. Si no llega ninguno, asignamos
  // como mínimo la del invocador para no dejar al usuario huérfano.
  const empresaIdsRaw = formData.getAll('empresa_ids') as string[]
  const empresaIds = Array.from(
    new Set(empresaIdsRaw.map((s) => (s ?? '').trim()).filter(Boolean)),
  )
  const finalEmpresaIds = empresaIds.length > 0 ? empresaIds : [empresaId]

  const { error: empresasError } = await admin
    .from('usuario_empresas')
    .insert(finalEmpresaIds.map((eid) => ({ user_id: data.user.id, empresa_id: eid })))

  if (empresasError) return { error: friendlyError(empresasError) }

  revalidatePath('/admin/empleados')
  revalidatePath('/ajustes')
  return { success: true }
}

export async function getEmployees() {
  // Leer no es administrar: basta con AJUSTES (ver). Con el guard de escritura,
  // un rol que solo consulta la pestaña Roles no podía ni listar los usuarios.
  await requireAjustesLectura()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    // Sin Supabase admin configurado (dev bypass): devolver lista vacía
    return { data: [] }
  }

  const { data: profiles, error } = await admin
    .from('usuarios')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { error: friendlyError(error), data: [] }

  // Rol de plataforma (director/empleado) derivado de la FUENTE ÚNICA:
  // empresa_roles.es_admin_plataforma del rol del usuario (usuarios.rol_id).
  const rolIds = Array.from(
    new Set((profiles ?? []).map((p: { rol_id?: string | null }) => p.rol_id).filter(Boolean) as string[]),
  )
  const { data: rolesAdmin } = rolIds.length
    ? await admin.from('empresa_roles').select('id, es_admin_plataforma').in('id', rolIds)
    : { data: [] as Array<{ id: string; es_admin_plataforma: boolean }> }
  const adminPorRol = new Map(
    (rolesAdmin ?? []).map((r: { id: string; es_admin_plataforma: boolean }) => [r.id, Boolean(r.es_admin_plataforma)]),
  )

  // Último acceso REAL: lo mantiene Supabase Auth solo (last_sign_in_at) y es la
  // única fuente con histórico completo — `ultima_actividad` solo existe desde
  // que el proxy empezó a marcarla. Mostramos el MÁS RECIENTE de los dos: el
  // login dice cuándo entró, la actividad dice hasta cuándo estuvo usándolo.
  const ultimoLoginPorUser = new Map<string, string>()
  try {
    // listUsers pagina de 50 en 50 por defecto; recorremos hasta agotar.
    for (let page = 1; page <= 40; page++) {
      const { data: authPage, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (authError) break
      const usuariosAuth = authPage?.users ?? []
      for (const u of usuariosAuth) {
        if (u.last_sign_in_at) ultimoLoginPorUser.set(u.id, u.last_sign_in_at)
      }
      if (usuariosAuth.length < 1000) break
    }
  } catch {
    // Sin acceso a Auth admin caemos a ultima_actividad: peor dato, no un fallo.
  }

  const masReciente = (a: string | null, b: string | null): string | null => {
    if (!a) return b
    if (!b) return a
    return new Date(a).getTime() >= new Date(b).getTime() ? a : b
  }

  const data = (profiles ?? []).map((p: { id: string; user_id?: string | null; rol_id?: string | null; rol_label?: string | null; ultima_actividad?: string | null }) => {
    const ultimoLogin = p.user_id ? ultimoLoginPorUser.get(p.user_id) ?? null : null
    return {
      ...p,
      role: (p.rol_id && adminPorRol.get(p.rol_id)) ? 'director' : 'empleado',
      // rol_label = nombre custom del rol (preferente para mostrar en UI)
      rol_label: p.rol_label ?? null,
      // ultima_actividad la escribe el proxy en CUALQUIER navegación autenticada
      // (móvil incluido). Se combina con el login de Auth para no perder el
      // histórico de quien entró antes de que existiera esa marca.
      ultima_actividad: masReciente(p.ultima_actividad ?? null, ultimoLogin),
    }
  })

  return { data }
}

export async function resetEmployeePassword(userId: string, newPassword: string) {
  await requireAdmin()

  const pwError = validateManualPassword(newPassword)
  if (pwError) return { error: pwError }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })

  if (error) return { error: friendlyError(error) }

  return { success: true }
}

/**
 * Cambia MANUALMENTE el email de acceso (login en auth.users) de un usuario
 * desde Ajustes → Usuarios, SIN tocar la contraseña (se conserva).
 *
 * El nuevo correo se guarda además como `email_empresa` en la ficha del empleado
 * vinculado (si existe), para que la fuente de ficha y el login no diverjan: la
 * regla canónica es login = empresa ?? personal, así que fijar el de empresa deja
 * ambos alineados. Notifica al empleado in-app del cambio.
 */
export async function updateEmployeeLoginEmail(userId: string, nuevoEmailRaw: string) {
  await requireAdmin()

  const nuevoEmail = (nuevoEmailRaw ?? '').trim().toLowerCase()
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!EMAIL_RE.test(nuevoEmail)) return { error: 'Introduce un correo válido.' }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  // Email actual (para no hacer nada si ya coincide y para el aviso).
  const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(userId)
  if (getErr || !authUser?.user) {
    return { error: getErr ? friendlyError(getErr) : 'Usuario no encontrado.' }
  }
  const anterior = (authUser.user.email ?? '').trim().toLowerCase() || null
  if (anterior === nuevoEmail) return { success: true, sinCambios: true }

  // Cambiar el email de login (conserva la contraseña).
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    email: nuevoEmail,
    email_confirm: true,
  })
  if (updErr) return { error: friendlyError(updErr) }

  // Alinear la ficha del empleado: el nuevo login pasa a ser su email de empresa.
  const { data: emp } = await admin
    .from('empleados')
    .select('id, empresa_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (emp?.id) {
    await admin.from('empleados').update({ email_empresa: nuevoEmail }).eq('id', emp.id)

    // Aviso in-app al empleado (no rompe si falla).
    if (emp.empresa_id) {
      try {
        const { emitirNotificacion } = await import(
          '@/features/notificaciones/actions/notificaciones-actions'
        )
        await emitirNotificacion({
          empresaId: emp.empresa_id as string,
          system: true,
          tipo: 'cambio_email_acceso',
          titulo: 'Tu correo de acceso ha cambiado',
          mensaje:
            `A partir de ahora inicias sesión con ${nuevoEmail}. ` +
            `Tu contraseña sigue siendo la misma.`,
          segmento: { tipo: 'empleados', empleadoIds: [emp.id as string] },
          payload: { anterior, nuevo: nuevoEmail },
          accionUrl: '/mi-panel',
        })
      } catch (e) {
        console.error('[admin] aviso cambio_email_acceso:', e)
      }
    }
  }

  revalidatePath('/ajustes')
  return { success: true, anterior, nuevo: nuevoEmail }
}

/**
 * Envía un correo de recuperación de contraseña al usuario indicado.
 *
 * Flujo:
 *   1. Generamos un magic link de tipo "recovery" con admin.generateLink.
 *   2. Si el SMTP global está configurado (SMTP_HOST/USER/PASS en .env), lo
 *      enviamos nosotros vía nodemailer.
 *   3. Si no, caemos al envío automático de Supabase (sandbox o el SMTP que
 *      tenga el proyecto), para no romper en entornos sin SMTP configurado.
 *
 * El enlace lleva a /update-password donde el usuario define su nueva clave.
 */
export async function sendPasswordResetEmail(profileId: string) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { data: profile, error: pErr } = await admin
    .from('usuarios')
    .select('email, nombre, apellidos, full_name, empresa_id')
    .eq('id', profileId)
    .maybeSingle()

  if (pErr) return { error: friendlyError(pErr) }
  if (!profile?.email) return { error: 'El usuario no tiene email asociado.' }

  const siteUrl = getSiteUrl()
  const redirectTo = `${siteUrl}/update-password`

  // 1) Generamos el magic link (no envía nada por sí mismo).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo },
  })

  const actionUrl = buildRecoveryActionUrl(siteUrl, linkData?.properties ?? undefined)
  if (linkErr || !actionUrl) {
    return { error: linkErr ? friendlyError(linkErr) : 'No se pudo generar el enlace de recuperación.' }
  }
  const recipientName =
    [profile.nombre, profile.apellidos].filter(Boolean).join(' ').trim() ||
    profile.full_name ||
    undefined

  // 2) Intentamos enviar con el SMTP global (configurado por el dueño del software).
  const { subject, html, text } = passwordResetEmail({
    recipientName,
    actionUrl,
  })

  const sendResult = await sendEmail({
    to: profile.email,
    subject,
    html,
    text,
    empresaId: (profile.empresa_id as string | null) ?? undefined,
    // Correo de sistema (recuperación de contraseña) → no-reply: no se responde al software.
  })

  if (sendResult.ok) {
    return { success: true, email: profile.email, transport: sendResult.transport }
  }

  // Si el SMTP devolvió error explícito, lo reportamos.
  if (sendResult.configured) {
    return { error: `No se pudo enviar el correo: ${sendResult.error}` }
  }

  // 3) Fallback: dejar que Supabase envíe el correo (sandbox / SMTP del proyecto).
  const { error: rErr } = await admin.auth.resetPasswordForEmail(profile.email, {
    redirectTo,
  })

  if (rErr) return { error: friendlyError(rErr) }

  return { success: true, email: profile.email, transport: 'supabase' as const }
}

export async function updateEmployeeStatus(profileId: string, estado: 'Activo' | 'Inactivo' | 'Pendiente') {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const { error } = await admin
    .from('usuarios')
    .update({ estado_acceso: estado })
    .eq('id', profileId)

  if (error) return { error: friendlyError(error) }

  revalidatePath('/ajustes')
  return { success: true }
}

export async function getEmpleadosSinAcceso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data: profile } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.empresa_id) return { data: [] }

  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre, apellidos, email_personal, email_empresa, departamentos(nombre)')
    .eq('empresa_id', profile.empresa_id)
    .eq('estado', 'Activo')
    .is('user_id', null)
    .order('nombre')

  if (error) return { error: friendlyError(error), data: [] }
  return { data: data ?? [] }
}

export async function updateEmployeeProfile(
  profileId: string,
  patch: {
    departamento?: string;
    role?: string;
    nombre?: string;
    apellidos?: string;
    esEmpleado?: boolean;
  }
) {
  await requireAdmin()

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  const profileUpdate: Record<string, string | boolean | null> = {}
  if (patch.departamento !== undefined) {
    const dep = patch.departamento.trim().toUpperCase()
    if (!dep) return { error: 'El departamento no puede estar vacío.' }
    profileUpdate.departamento = dep
  }
  if (patch.nombre !== undefined) profileUpdate.nombre = capitalizeText(patch.nombre)
  if (patch.apellidos !== undefined) profileUpdate.apellidos = capitalizeText(patch.apellidos)
  if (patch.esEmpleado !== undefined) profileUpdate.es_empleado = patch.esEmpleado

  // El rol que llega es el NOMBRE custom (de empresa_roles). Lo guardamos en rol_label
  // y derivamos el app_role para user_roles. Validamos contra empresa_roles para
  // evitar guardar roles inventados. Validamos primero contra la empresa del INVOCADOR
  // (que es la que alimenta el dropdown de la UI). Si el target pertenece a otra
  // empresa, intentamos también con la del target para mantener compatibilidad.
  if (patch.role !== undefined) {
    const trimmed = patch.role.trim()
    if (trimmed) {
      const supabase = await createClient()
      const { data: { user: invoker } } = await supabase.auth.getUser()
      const { data: invokerProfile } = invoker
        ? await admin.from('usuarios').select('empresa_id').eq('user_id', invoker.id).maybeSingle()
        : { data: null }
      const { data: target } = await admin
        .from('usuarios')
        .select('empresa_id')
        .eq('id', profileId)
        .maybeSingle()

      const empresasACheckear = [invokerProfile?.empresa_id, target?.empresa_id]
        .filter((id): id is string => Boolean(id))
      const empresasUnicas = Array.from(new Set(empresasACheckear))

      if (empresasUnicas.length === 0) {
        return { error: 'No se pudo determinar la empresa para validar el rol.' }
      }

      let rolEncontrado = false
      let ultimoError: string | undefined
      for (const empId of empresasUnicas) {
        const validation = await assertRoleExistsInEmpresa(admin, empId, trimmed)
        if (!validation.error) { rolEncontrado = true; break }
        ultimoError = validation.error
      }
      if (!rolEncontrado) return { error: ultimoError ?? `El rol "${trimmed}" no existe.` }
    }
    profileUpdate.rol_label = trimmed || null
  }

  // Al actualizar rol_label, el trigger sync_usuario_rol_id fija usuarios.rol_id
  // (fuente única PRP-063); la tabla legacy usuario_roles ya no se escribe.
  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin
      .from('usuarios')
      .update(profileUpdate)
      .eq('id', profileId)
    if (error) return { error: friendlyError(error) }
  }

  revalidatePath('/ajustes')
  return { success: true }
}

export async function getDepartamentosDisponibles(): Promise<{
  data: string[]
  error?: string
}> {
  try {
    const admin = createAdminClient()
    // Recoge los rol distintos de cronogramas_operativos como lista canónica
    const { data, error } = await admin
      .from('cronogramas_operativos')
      .select('rol')
      .not('rol', 'is', null)
    if (error) return { data: [], error: friendlyError(error) }
    const set = new Set<string>()
    for (const row of data ?? []) {
      const r = (row as { rol: string | null }).rol
      if (r && r.trim()) set.add(r.trim().toUpperCase())
    }
    return { data: Array.from(set).sort() }
  } catch {
    // Fallback razonable si admin no está disponible
    return {
      data: [
        'DIRECCION', 'SALA', 'COCINA', 'CALIDAD', 'RECURSOS HUMANOS',
        'MARKETING', 'LOGISTICA', 'CONTABILIDAD', 'GESTORIA', 'JURIDICO', 'GERENCIA',
      ],
    }
  }
}

export async function deleteEmployee(userId: string) {
  const invoker = await requireAdmin()

  if (invoker.id === userId) {
    return { error: 'No puedes borrar tu propio usuario.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Supabase admin no configurado. Configura SUPABASE_SERVICE_ROLE_KEY.' }
  }

  // ─── REGLA DURA: no se borra un empleado YA GRABADO ──────────────────────
  // Nada de lo que un empleado hizo debe eliminarse: aunque en el futuro se le
  // deshabilite, todo su historial (fichajes, turnos, documentos, nóminas,
  // pagos, promociones…) queda guardado como registro legal. Borrar el usuario
  // de auth.users dispara ON DELETE CASCADE a través de profiles → empleados →
  // todas sus tablas hijas, destruyendo ese historial de forma irreversible.
  // Por eso, si el empleado tiene datos, se BLOQUEA el borrado: la única vía es
  // marcarlo como Inactivo (desde RRHH → Empleados). Solo se permite descartar
  // altas en borrador sin perfil completado y sin datos.
  // Misma guarda que `deleteEmpleado` en rrhh/actions/empleados-actions.ts.
  const { data: emp } = await admin
    .from('empleados')
    .select('id, perfil_completado, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  let tieneDatos = Boolean(emp?.perfil_completado)
  if (!tieneDatos) {
    const [{ count: nFichajes }, { count: nTurnos }, { count: nPatrones }] =
      await Promise.all([
        admin
          .from('fichajes')
          .select('id', { count: 'exact', head: true })
          .eq('empleado_id', userId),
        emp?.id
          ? admin
              .from('rrhh_turno_empleados')
              .select('turno_id', { count: 'exact', head: true })
              .eq('empleado_id', emp.id)
          : Promise.resolve({ count: 0 }),
        emp?.id
          ? admin
              .from('rrhh_patron_empleados')
              .select('patron_id', { count: 'exact', head: true })
              .eq('empleado_id', emp.id)
          : Promise.resolve({ count: 0 }),
      ])
    tieneDatos =
      (nFichajes ?? 0) > 0 || (nTurnos ?? 0) > 0 || (nPatrones ?? 0) > 0
  }

  if (tieneDatos) {
    return {
      error:
        'No se puede borrar un empleado ya grabado (tiene fichajes, turnos, documentos o histórico). Márcalo como Inactivo en su lugar para conservar su registro.',
    }
  }

  // Limpiamos manualmente las filas dependientes en public.* antes de borrar
  // el usuario en auth.users. Si dejamos que la cascada del FK lo haga, corre
  // como `supabase_auth_admin`, que NO tiene DELETE sobre estas tablas y el
  // borrado falla con "permission denied for table empleados".
  const cleanups: { table: 'empleados' | 'usuario_empresas'; column: string }[] = [
    { table: 'empleados', column: 'user_id' },
    { table: 'usuario_empresas', column: 'user_id' },
  ]
  for (const { table, column } of cleanups) {
    const { error: cleanErr } = await admin.from(table).delete().eq(column, userId)
    if (cleanErr) return { error: friendlyError(cleanErr) }
  }
  // profiles.id == auth.user.id en este proyecto (mismo UUID); cubrimos también user_id por legacy.
  await admin.from('usuarios').delete().eq('id', userId)
  await admin.from('usuarios').delete().eq('user_id', userId)

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return { error: friendlyError(error) }

  revalidatePath('/admin/empleados')
  revalidatePath('/ajustes')
  return { success: true }
}
