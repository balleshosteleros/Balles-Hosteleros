import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";

type AdminClient = ReturnType<typeof createAdminClient>;

const ROLES_ADMIN = ["admin", "director"] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard de autorización compartido del alta de empleados.
 *
 * Exige rol admin/director y, si se pasan `empresaIds`, que el usuario
 * pertenezca a todas ellas (el rol plataforma `director` opera cross-tenant
 * y salta el scope por empresa). Lanza `Error` si no cumple.
 *
 * Lo usan tanto el alta directa (`createEmpleado`) como la promoción de
 * candidatos (`promoverCandidato`): única fuente de verdad de autorización.
 */
export async function requireAdminUser(opts?: { empresaIds?: string[] }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: rolesRows } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.some((r) =>
    (ROLES_ADMIN as readonly string[]).includes(r),
  );
  if (!isAdmin) {
    throw new Error("Sin permisos: solo admin o director pueden modificar empleados");
  }

  // director (rol plataforma) opera cross-tenant; salta el scope por empresa.
  if (opts?.empresaIds && opts.empresaIds.length > 0 && !roles.includes("director")) {
    const empresasReq = Array.from(
      new Set(opts.empresaIds.filter((id) => typeof id === "string" && UUID_RE.test(id))),
    );
    if (empresasReq.length === 0) {
      throw new Error("Sin permisos: empresas no válidas");
    }
    const { data: rels } = await supabase
      .from("usuario_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .in("empresa_id", empresasReq);
    const accesibles = new Set((rels ?? []).map((r: { empresa_id: string }) => r.empresa_id));
    const sinAcceso = empresasReq.filter((id) => !accesibles.has(id));
    if (sinAcceso.length > 0) {
      throw new Error(
        sinAcceso.length === 1
          ? "Sin permisos: no tienes acceso a esa empresa"
          : `Sin permisos: no tienes acceso a ${sinAcceso.length} de las empresas seleccionadas`,
      );
    }
  }

  return user;
}

/**
 * Guard de autorización para gestionar/duplicar empleados entre empresas.
 *
 * NO se basa en "grupo": cada empresa es individual. Exige que el usuario:
 *  1) tenga permiso de RECURSOS HUMANOS (editar) en su rol, y
 *  2) tenga acceso real (`usuario_empresas` ∪ empresa principal) a TODAS las
 *     empresas objetivo.
 * El rol `director` (plataforma) es superusuario y salta ambos chequeos.
 * Ejemplo: quien tenga las dos empresas pero sin RRHH (p. ej. CALIDAD) NO pasa;
 * quien tenga las dos + RRHH sí. Lanza `Error` si no cumple.
 */
export async function requireRRHHAcceso(empresaIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: rolesRows } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", user.id);
  const esDirector = (rolesRows ?? []).some((r: { role: string }) => r.role === "director");
  if (esDirector) return user;

  // 1) Permiso de Recursos Humanos (editar) en el rol del usuario.
  const { permisos } = await getUserPermisos();
  const tieneRRHH = permisos.some((p) => p.modulo === "RECURSOS HUMANOS" && p.editar);
  if (!tieneRRHH) {
    throw new Error(
      "Sin permisos: necesitas acceso a Recursos Humanos para gestionar empleados.",
    );
  }

  // 2) Acceso real a TODAS las empresas objetivo.
  const empresasReq = Array.from(
    new Set(empresaIds.filter((id) => typeof id === "string" && UUID_RE.test(id))),
  );
  if (empresasReq.length > 0) {
    const [{ data: rels }, { data: prof }] = await Promise.all([
      supabase
        .from("usuario_empresas")
        .select("empresa_id")
        .eq("user_id", user.id)
        .in("empresa_id", empresasReq),
      supabase.from("usuarios").select("empresa_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const accesibles = new Set((rels ?? []).map((r: { empresa_id: string }) => r.empresa_id));
    if (prof?.empresa_id) accesibles.add(prof.empresa_id as string);
    const sinAcceso = empresasReq.filter((id) => !accesibles.has(id));
    if (sinAcceso.length > 0) {
      throw new Error("Sin permisos: no tienes acceso a esa empresa.");
    }
  }

  return user;
}

export type AltaUsuarioEmpleadoInput = {
  /** Cliente admin (service role) ya creado por el caller. */
  admin: AdminClient;
  /** Email de login en auth.users (emailEmpresa ?? emailPersonal). */
  loginEmail: string;
  emailPersonal: string;
  emailEmpresa?: string | null;
  fullName: string;
  nombre: string;
  apellidos: string | null;
  telefono?: string | null;
  dniNie?: string | null;
  /** Ya resuelto a un id real o null por el caller (sin mocks). */
  departamentoId?: string | null;
  /** Nombre de puesto en TEXT (empleados.puesto no es FK). */
  puesto?: string | null;
  empresaPrincipalId: string;
  /** Empresas a las que tendrá acceso (debe incluir la principal). */
  empresasAcceso: string[];
  /** Locales donde podrá fichar (de cualquiera de sus empresas). Mínimo 1. */
  localIds: string[];
};

export type AltaUsuarioEmpleadoResult =
  | { ok: true; userId: string; empleadoId: string; tempPassword: string }
  | { ok: false; error: string };

/**
 * Núcleo canónico de alta de empleado. Crea en cascada:
 *   auth.user → profile → user_roles(empleado) → user_empresas → empleado
 * validando el local y revirtiendo con `deleteUser` (CASCADE limpia profile,
 * user_roles y user_empresas) si cualquier paso posterior falla.
 *
 * Única fuente de verdad: la usan `createEmpleado` (alta directa) y
 * `promoverCandidato` (promoción) para no divergir.
 */
export async function altaUsuarioEmpleado(
  input: AltaUsuarioEmpleadoInput,
): Promise<AltaUsuarioEmpleadoResult> {
  const { admin } = input;
  const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

  // 1. Crear auth.user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.loginEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (createErr || !created?.user) {
    return { ok: false, error: createErr ? friendlyError(createErr) : "No se pudo crear el usuario" };
  }
  const userId = created.user.id;

  // 2. Completar profile (el trigger handle_new_user crea la fila base).
  //    profiles.id === profiles.user_id === auth.users.id (migración 002).
  await admin
    .from("usuarios")
    .update({
      empresa_id: input.empresaPrincipalId,
      full_name: input.fullName,
      nombre: input.nombre,
      apellidos: input.apellidos,
      rol_label: "EMPLEADO",
      es_empleado: true,
      avatar_obligatorio: true,
    })
    .eq("id", userId);

  // 3. Rol RBAC base
  await admin.from("usuario_roles").insert({ user_id: userId, role: "empleado" });

  // 4. Acceso multi-empresa (rollback si falla)
  const accesosRows = input.empresasAcceso.map((eid) => ({
    user_id: userId,
    empresa_id: eid,
  }));
  const { error: accesoErr } = await admin
    .from("usuario_empresas")
    .upsert(accesosRows, { onConflict: "user_id,empresa_id" });
  if (accesoErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Error asignando acceso a empresas: ${friendlyError(accesoErr)}` };
  }

  // 5. Validar los locales: deben existir y pertenecer a una de las empresas
  //    a las que el empleado tendrá acceso (rollback si alguno no cumple).
  const localIds = Array.from(new Set((input.localIds ?? []).filter(Boolean)));
  if (localIds.length === 0) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Asigna al menos un local donde el empleado pueda fichar." };
  }
  const { data: localesRows, error: localErr } = await admin
    .from("locales")
    .select("id, empresa_id")
    .in("id", localIds);
  const empresasPermitidas = new Set(input.empresasAcceso);
  const validos = (localesRows ?? []).filter((l) => empresasPermitidas.has(l.empresa_id));
  if (localErr || validos.length !== localIds.length) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Todos los locales deben pertenecer a las empresas del empleado." };
  }
  // Local por defecto (compat empleados.local_id): uno de la empresa principal si hay.
  const localDefecto =
    validos.find((l) => l.empresa_id === input.empresaPrincipalId)?.id ?? validos[0].id;

  // 6. Crear empleado vinculado (rollback si falla)
  const { data: empleado, error: empErr } = await admin
    .from("empleados")
    .insert({
      empresa_id: input.empresaPrincipalId,
      user_id: userId,
      nombre: input.nombre,
      apellidos: input.apellidos,
      departamento_id: input.departamentoId ?? null,
      puesto: input.puesto ?? null,
      email_empresa: input.emailEmpresa ?? null,
      email_personal: input.emailPersonal,
      dni_nie: input.dniNie ?? null,
      telefono: input.telefono ?? null,
      fecha_alta: new Date().toISOString().slice(0, 10),
      estado: "Activo",
      tipo_jornada: "Completa",
      perfil_completado: false,
      local_id: localDefecto,
    })
    .select("id")
    .single();
  if (empErr || !empleado) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: empErr ? friendlyError(empErr) : "No se pudo crear el empleado" };
  }

  // 7. Conjunto de locales donde puede fichar (tabla puente). Rollback si falla.
  const puenteRows = localIds.map((local_id) => ({ empleado_id: empleado.id, local_id }));
  const { error: puenteErr } = await admin.from("empleado_locales").insert(puenteRows);
  if (puenteErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Error asignando locales: ${friendlyError(puenteErr)}` };
  }

  return { ok: true, userId, empleadoId: empleado.id, tempPassword };
}
