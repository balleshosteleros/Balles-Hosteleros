import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { getRolContext } from "@/features/auth/actions/permisos-actions";

type AdminClient = ReturnType<typeof createAdminClient>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard de autorización compartido del alta/gestión de empleados.
 *
 * Fuente única (PRP-063): exige rol DIRECTOR (`empresa_roles.es_admin_plataforma`,
 * derivado vía `getRolContext`), que opera cross-tenant. Mantiene la firma con
 * `empresaIds` por compatibilidad; el director no se filtra por empresa.
 *
 * Lo usan tanto el alta directa (`createEmpleado`) como la promoción de
 * candidatos (`promoverCandidato`): única fuente de verdad de autorización.
 */
export async function requireAdminUser(opts?: { empresaIds?: string[] }) {
  // Manda el permiso RECURSOS HUMANOS (editar) de Ajustes → Roles, no el flag
  // de director. Delegamos en `requireRRHHAcceso`, que además valida el acceso
  // real a las empresas objetivo: antes, el director se saltaba ese scope.
  return requireRRHHAcceso(opts?.empresaIds ?? []);
}

/**
 * Guard de LECTURA de la lista de empleados de una empresa.
 *
 * Leer no es modificar: aquí basta con permiso de RECURSOS HUMANOS (`ver`) y
 * acceso real a la empresa consultada. Antes esta lectura pasaba por
 * `requireAdminUser` (solo DIRECTOR), así que un rol como GERENCIA —con RRHH
 * concedido— recibía un error que la vista pintaba como "No hay empleados
 * todavía": parecía una empresa vacía en vez de una falta de permisos.
 *
 * El director sigue siendo super-usuario cross-tenant.
 */
export async function requireEmpleadosLectura(empresaId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ctx = await getRolContext(user.id);
  const tieneRRHH = ctx.permisos.some((p) => p.modulo === "RECURSOS HUMANOS" && p.ver);
  if (!tieneRRHH) {
    throw new Error(
      "Sin permisos: necesitas acceso a Recursos Humanos para ver los empleados.",
    );
  }

  // Acceso real a la empresa consultada (empresa principal ∪ usuario_empresas).
  if (UUID_RE.test(empresaId)) {
    const [{ data: rel }, { data: prof }] = await Promise.all([
      supabase
        .from("usuario_empresas")
        .select("empresa_id")
        .eq("user_id", user.id)
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      supabase.from("usuarios").select("empresa_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const tieneAcceso = Boolean(rel) || prof?.empresa_id === empresaId;
    if (!tieneAcceso) {
      throw new Error("Sin permisos: no tienes acceso a esa empresa.");
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

  // Fuente única (PRP-063): rol + permisos derivados de usuarios.rol_id.
  // Sin bypass de director: manda lo aprobado en Ajustes → Roles.
  const ctx = await getRolContext(user.id);

  // 1) Permiso de Recursos Humanos (editar) en el rol del usuario.
  const tieneRRHH = ctx.permisos.some((p) => p.modulo === "RECURSOS HUMANOS" && p.editar);
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
  tipoDocumento?: string | null;
  codigoPostal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  estadoCivil?: string | null;
  emgNombre?: string | null;
  emgTelefono?: string | null;
  emgRelacion?: string | null;
  /** Datos personales aportados en la documentación del candidato (para gestoría). */
  numeroSs?: string | null;
  iban?: string | null;
  direccion?: string | null;
  fechaNacimiento?: string | null;
  /** Ya resuelto a un id real o null por el caller (sin mocks). */
  departamentoId?: string | null;
  /** Nombre de puesto en TEXT (empleados.puesto no es FK). */
  puesto?: string | null;
  /**
   * Puesto del que hereda su departamento validador. Sin él, el empleado nace
   * sin nadie que pueda aprobarle una solicitud. Si no se pasa, se intenta
   * resolver por el nombre de `puesto` dentro de la empresa.
   */
  puestoId?: string | null;
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
 * Configuración que un empleado hereda de su puesto al darse de alta.
 * `null` = el puesto no lo tenía definido.
 */
type HerenciaDePuesto = {
  validadorDepartamentoId: string | null;
};

/**
 * Resuelve el departamento validador que le toca a un empleado nuevo según su
 * puesto. El puesto se busca por id si el caller lo tiene, y si no por nombre
 * dentro de la empresa (`empleados.puesto` es texto, no una clave).
 */
async function resolverHerenciaDePuesto(
  admin: AdminClient,
  input: { empresaId: string; puestoId: string | null; puestoNombre: string | null },
): Promise<HerenciaDePuesto> {
  const vacio: HerenciaDePuesto = { validadorDepartamentoId: null };
  type FilaPuesto = { validador_departamento_id: string | null };

  try {
    let puesto: FilaPuesto | null = null;

    if (input.puestoId) {
      const { data } = await admin
        .from("puestos")
        .select("validador_departamento_id")
        .eq("id", input.puestoId)
        .eq("empresa_id", input.empresaId)
        .maybeSingle();
      puesto = (data as unknown as FilaPuesto | null) ?? null;
    } else if (input.puestoNombre?.trim()) {
      const { data } = await admin
        .from("puestos")
        .select("validador_departamento_id")
        .eq("empresa_id", input.empresaId)
        .ilike("nombre", input.puestoNombre.trim())
        .maybeSingle();
      puesto = (data as unknown as FilaPuesto | null) ?? null;
    }

    return { validadorDepartamentoId: puesto?.validador_departamento_id ?? null };
  } catch (err) {
    // Que no se caiga un alta por esto: el empleado se crea igual y RRHH
    // puede asignarle el calendario después.
    console.error("[rrhh] resolverHerenciaDePuesto:", err);
    return vacio;
  }
}

/** Dato que provocó la coincidencia, para poder decírselo al usuario. */
export type CampoDuplicado = "documento" | "nombre" | "correo";

export type EmpleadoDuplicado = {
  campo: CampoDuplicado;
  /** Texto del dato que coincide (p. ej. el DNI o el correo). */
  valor: string;
  empleadoId: string;
  nombreCompleto: string;
  /** 'Activo' | 'Inactivo' — decide si el mensaje habla de reactivar. */
  estado: string | null;
};

/** Normaliza documento: mayúsculas, sin guiones ni espacios. */
function normDoc(v: string | null | undefined): string {
  return (v ?? "").toUpperCase().replace(/[\s-]/g, "").trim();
}

/** Normaliza texto libre (nombre/apellidos): minúsculas, sin acentos ni dobles espacios. */
function normTexto(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normEmail(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().trim();
}

/**
 * Comprueba si ya existe un empleado en LA MISMA empresa que coincida por
 * documento (DNI/NIE/pasaporte), por nombre+apellidos o por cualquiera de sus
 * dos correos. Devuelve la primera coincidencia encontrada, o null.
 *
 * El alcance es intencionadamente por empresa: trabajar en dos empresas del
 * grupo es normal y NO se considera duplicado (decisión de Ivan, 2026-08-05).
 *
 * Se compara en memoria (no en SQL) para poder normalizar igual que la UI:
 * "12345678-z" y "12345678Z" son el mismo documento, y "José" = "jose".
 */
export async function buscarEmpleadoDuplicado(
  admin: AdminClient,
  empresaId: string,
  datos: {
    dniNie?: string | null;
    nombre?: string | null;
    apellidos?: string | null;
    emailPersonal?: string | null;
    emailEmpresa?: string | null;
  },
  /** Ficha a ignorar (al editar/copiar, no debe chocar consigo misma). */
  excluirEmpleadoId?: string | null,
): Promise<EmpleadoDuplicado | null> {
  const { data, error } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, dni_nie, email_personal, email_empresa, estado")
    .eq("empresa_id", empresaId);

  if (error || !data) return null;

  const doc = normDoc(datos.dniNie);
  const nom = normTexto(datos.nombre);
  const ape = normTexto(datos.apellidos);
  const mails = [normEmail(datos.emailPersonal), normEmail(datos.emailEmpresa)].filter(Boolean);

  for (const e of data) {
    if (excluirEmpleadoId && e.id === excluirEmpleadoId) continue;

    const nombreCompleto = [e.nombre, e.apellidos].filter(Boolean).join(" ").trim();
    const base = { empleadoId: e.id as string, nombreCompleto, estado: (e.estado as string | null) ?? null };

    // 1. Documento: el criterio más fuerte.
    if (doc && normDoc(e.dni_nie as string | null) === doc) {
      return { ...base, campo: "documento", valor: (datos.dniNie ?? "").trim() };
    }

    // 2. Correo: cualquiera de los dos del alta contra cualquiera de los dos existentes.
    const mailsExistentes = [
      normEmail(e.email_personal as string | null),
      normEmail(e.email_empresa as string | null),
    ].filter(Boolean);
    const coincide = mails.find((m) => mailsExistentes.includes(m));
    if (coincide) {
      return { ...base, campo: "correo", valor: coincide };
    }

    // 3. Nombre + apellidos: sólo si hay apellidos, para no bloquear por un
    // nombre de pila suelto (demasiado común y daría falsos positivos).
    if (nom && ape && normTexto(e.nombre as string | null) === nom && normTexto(e.apellidos as string | null) === ape) {
      return { ...base, campo: "nombre", valor: `${(datos.nombre ?? "").trim()} ${(datos.apellidos ?? "").trim()}`.trim() };
    }
  }

  return null;
}

const ETIQUETA_CAMPO: Record<CampoDuplicado, string> = {
  documento: "el documento",
  nombre: "el nombre y apellidos",
  correo: "el correo",
};

/**
 * Mensaje que ve el usuario. Dice QUÉ dato coincide y con quién, y deja claro
 * que la única salida es activar la ficha existente, nunca crear otra.
 */
export function mensajeDuplicado(dup: EmpleadoDuplicado): string {
  const queHacer =
    dup.estado === "Activo"
      ? "Ya está activo, así que no hay nada que crear."
      : "Solo puedes activar la ficha que ya existe; no se puede crear una nueva.";
  return `Esta persona ya está en la base de datos: coincide ${ETIQUETA_CAMPO[dup.campo]} «${dup.valor}» con ${dup.nombreCompleto || "un empleado existente"} (${dup.estado === "Activo" ? "activo" : "inactivo"}). ${queHacer}`;
}

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

  // 0. Anti-duplicados (misma empresa). ANTES de crear nada en auth.users, para
  // no dejar usuarios huérfanos ni depender del rollback. Bloquea por documento,
  // por nombre+apellidos o por correo: si la persona ya está, solo se puede
  // activar su ficha existente, nunca crear otra.
  const duplicado = await buscarEmpleadoDuplicado(admin, input.empresaPrincipalId, {
    dniNie: input.dniNie,
    nombre: input.nombre,
    apellidos: input.apellidos,
    emailPersonal: input.emailPersonal,
    emailEmpresa: input.emailEmpresa,
  });
  if (duplicado) {
    return { ok: false, error: mensajeDuplicado(duplicado) };
  }

  // 1. Crear auth.user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.loginEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (createErr || !created?.user) {
    return { ok: false, error: createErr ? friendlyError(createErr, "alta:createUser") : "No se pudo crear el usuario" };
  }
  const userId = created.user.id;

  // 2a. El rol del usuario = el DEPARTAMENTO al que pertenece el empleado.
  //     Los roles (`empresa_roles`) son los departamentos (SALA, COCINA, …):
  //     existe un rol por departamento con el mismo nombre. Una camarera de
  //     SALA tiene rol SALA. NUNCA un rol inexistente como "EMPLEADO".
  //     Resolvemos el nombre del departamento y lo usamos como rol_label; el
  //     trigger `sync_usuario_rol_id` lo enlaza a `empresa_roles` (→ rol_id).
  let rolLabel: string | null = null;
  if (input.departamentoId) {
    const { data: depto } = await admin
      .from("departamentos")
      .select("nombre")
      .eq("id", input.departamentoId)
      .maybeSingle();
    rolLabel = (depto?.nombre as string | null) ?? null;
  }
  if (!rolLabel) {
    // Sin departamento no podemos derivar un rol válido: abortamos en vez de
    // dejar un usuario con rol_label inexistente y rol_id nulo (sin permisos).
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "No se pudo determinar el rol: el empleado debe tener un departamento asignado." };
  }

  // 2b. Completar profile (el trigger handle_new_user crea la fila base).
  //    profiles.id === profiles.user_id === auth.users.id (migración 002).
  await admin
    .from("usuarios")
    .update({
      empresa_id: input.empresaPrincipalId,
      full_name: input.fullName,
      nombre: input.nombre,
      apellidos: input.apellidos,
      rol_label: rolLabel,
      es_empleado: true,
      avatar_obligatorio: true,
    })
    .eq("id", userId);

  // 3. El rol se enlaza por usuarios.rol_id (lo fija el trigger desde rol_label);
  //    la tabla legacy usuario_roles ya no se escribe (fuente única PRP-063).

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
    return { ok: false, error: `Error asignando acceso a empresas: ${friendlyError(accesoErr, "alta:usuarioEmpresas")}` };
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

  // 5b. Configuración que se hereda del PUESTO: calendario de vacaciones y
  // departamento validador. Va aquí, en el núcleo, porque por esta función
  // pasan TODAS las altas (manual, contratación y promoción de candidato): si
  // se hiciera en cada caller, el que se olvidara crearía empleados sin
  // calendario, que es justo lo que pasaba antes.
  const herencia = await resolverHerenciaDePuesto(admin, {
    empresaId: input.empresaPrincipalId,
    puestoId: input.puestoId ?? null,
    puestoNombre: input.puesto ?? null,
  });

  // ¿Trae ya todo lo que antes se preguntaba al entrar por primera vez?
  const perfilYaCompleto = Boolean(
    input.tipoDocumento &&
      input.estadoCivil &&
      input.codigoPostal &&
      input.ciudad &&
      input.provincia &&
      input.pais &&
      input.emgNombre &&
      input.emgTelefono,
  );

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
      validador_departamento_id: herencia.validadorDepartamentoId,
      email_empresa: input.emailEmpresa ?? null,
      email_personal: input.emailPersonal,
      dni_nie: input.dniNie ?? null,
      tipo_documento: input.tipoDocumento ?? null,
      codigo_postal: input.codigoPostal ?? null,
      ciudad: input.ciudad ?? null,
      provincia: input.provincia ?? null,
      pais: input.pais ?? null,
      estado_civil: input.estadoCivil ?? null,
      contacto_emergencia_nombre: input.emgNombre ?? null,
      contacto_emergencia_telefono: input.emgTelefono ?? null,
      contacto_emergencia_relacion: input.emgRelacion ?? null,
      // Datos personales de la documentación (para que la gestoría los reciba).
      numero_ss: input.numeroSs ?? null,
      iban: input.iban ?? null,
      direccion: input.direccion ?? null,
      fecha_nacimiento: input.fechaNacimiento ?? null,
      telefono: input.telefono ?? null,
      fecha_alta: new Date().toISOString().slice(0, 10),
      estado: "Activo",
      tipo_jornada: "Completa",
      // El asistente de primer acceso solo existe para los empleados ANTIGUOS,
      // los que ya estaban antes de que la documentación se pidiera entera en el
      // proceso de selección. Si el alta viene de reclutamiento con los datos
      // del contrato, la ficha ya está completa y no hay nada que preguntarle:
      // entra directo a trabajar.
      perfil_completado: perfilYaCompleto,
      local_id: localDefecto,
    })
    .select("id")
    .single();
  if (empErr || !empleado) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: empErr ? friendlyError(empErr, "alta:insertEmpleado") : "No se pudo crear el empleado" };
  }

  // 7. Conjunto de locales donde puede fichar (tabla puente). Rollback si falla.
  const puenteRows = localIds.map((local_id) => ({ empleado_id: empleado.id, local_id }));
  const { error: puenteErr } = await admin.from("empleado_locales").insert(puenteRows);
  if (puenteErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: `Error asignando locales: ${friendlyError(puenteErr, "alta:empleadoLocales")}` };
  }

  return { ok: true, userId, empleadoId: empleado.id, tempPassword };
}



// La regla de qué correo es el login vive en un módulo aparte (sin
// `server-only`) para poder probarla sin BD. Se reexporta para no romper a
// quien ya la importaba desde aquí.
export { resolverLoginEmail } from "@/features/rrhh/services/acceso-email-regla";
import { resolverLoginEmail } from "@/features/rrhh/services/acceso-email-regla";

/**
 * Sincroniza el email de login (auth.users + usuarios.email) de un empleado con
 * el que dicta la regla `resolverLoginEmail`, SIN tocar la contraseña (se
 * conserva). Idempotente: si el login ya coincide, no hace nada.
 *
 * Notifica al propio empleado in-app cuando el login cambia, para que sepa que a
 * partir de ahora entra con el nuevo correo (misma contraseña).
 *
 * Se usa tanto al editar el email de empresa en la ficha como al cambiarlo a mano
 * desde Ajustes → Usuarios. Fuente única: no dupliques esta lógica.
 */
export async function sincronizarLoginEmailEmpleado(input: {
  admin: AdminClient;
  empleadoId: string;
  /** Correos ya resueltos del empleado (los que se van a persistir en la ficha). */
  emailEmpresa?: string | null;
  emailPersonal?: string | null;
  /** Notificar al empleado del cambio de login (default true). */
  notificar?: boolean;
  /**
   * Cambiar el correo de acceso aunque la cuenta ya tenga uno fijado. Solo
   * para el cambio deliberado desde Ajustes → Usuarios. En el guardado normal
   * de la ficha va a false: el login se mueve solo si se ha editado el correo
   * con el que la persona entraba (ver la regla dentro de la función).
   */
  forzar?: boolean;
  /**
   * Correos que la ficha tenía ANTES de guardar. Son los que permiten saber con
   * cuál de los dos entraba la persona y, por tanto, si este cambio le mueve el
   * acceso. Sin ellos la función no toca el acceso de una cuenta ya creada.
   */
  emailEmpresaAnterior?: string | null;
  emailPersonalAnterior?: string | null;
}): Promise<
  | { ok: true; cambiado: false }
  | { ok: true; cambiado: true; anterior: string | null; nuevo: string }
  | { ok: false; error: string }
> {
  const { admin, empleadoId } = input;

  const nuevoLogin = resolverLoginEmail({
    emailEmpresa: input.emailEmpresa,
    emailPersonal: input.emailPersonal,
  });
  // Sin ningún correo no hay login que fijar: no tocamos nada.
  if (!nuevoLogin) return { ok: true, cambiado: false };

  // Localizar el usuario de auth vinculado al empleado.
  const { data: emp, error: empErr } = await admin
    .from("empleados")
    .select("user_id, empresa_id")
    .eq("id", empleadoId)
    .maybeSingle();
  if (empErr) return { ok: false, error: friendlyError(empErr, "sincronizarLoginEmailEmpleado") };
  if (!emp?.user_id) return { ok: true, cambiado: false }; // empleado sin login vinculado

  // Email actual en auth.users.
  const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(emp.user_id);
  if (getErr || !authUser?.user) {
    return { ok: false, error: getErr ? friendlyError(getErr, "sincronizarLoginEmailEmpleado") : "Usuario de acceso no encontrado." };
  }
  const anterior = (authUser.user.email ?? "").trim().toLowerCase() || null;
  if (anterior === nuevoLogin) return { ok: true, cambiado: false }; // ya coincide

  // Regla de Iván (29-ago-2026), que sustituye a la del 27-ago: el correo de
  // acceso de una cuenta YA CREADA no se mueve nunca solo. Editar en la ficha
  // el correo personal o el de empresa es un cambio de CONTACTO y no toca el
  // login: cambiarlo es una decisión deliberada que se hace a mano entrando al
  // usuario en Ajustes → Usuarios (`forzar: true`).
  //
  // Lo único automático es FIJARLO la primera vez, cuando la cuenta aún no
  // tiene correo de acceso: es el alta que llega por reclutamiento, y ahí manda
  // `resolverLoginEmail` (empresa si tiene; si no, personal).
  if (!input.forzar && anterior !== null) {
    return { ok: true, cambiado: false };
  }

  // Cambiar SOLO el email en auth.users. La contraseña se conserva intacta.
  // email_confirm: true → el nuevo correo queda confirmado sin pedir verificación.
  const { error: updErr } = await admin.auth.admin.updateUserById(emp.user_id, {
    email: nuevoLogin,
    email_confirm: true,
  });
  if (updErr) return { ok: false, error: friendlyError(updErr, "anterior") };

  // `usuarios` es la fuente única del acceso (el candado `handle_new_user()`
  // valida contra `usuarios.email`): si no se actualiza aquí, la cuenta quedaría
  // con el correo viejo en la tabla que manda y el nuevo no podría entrar.
  const { error: usuErr } = await admin
    .from("usuarios")
    .update({ email: nuevoLogin, updated_at: new Date().toISOString() })
    .eq("user_id", emp.user_id);
  if (usuErr) {
    // Revertir auth para no dejar las dos tablas divergentes.
    if (anterior) {
      await admin.auth.admin.updateUserById(emp.user_id, {
        email: anterior,
        email_confirm: true,
      });
    }
    return { ok: false, error: friendlyError(usuErr, "anterior") };
  }

  // Anular el acceso por el correo ANTIGUO también en Google: al cambiar el
  // email, Supabase conserva la identity OAuth vieja y la persona seguiría
  // pudiendo entrar con "Continuar con Google" usando el correo anterior. El
  // trigger `purge_old_identities_on_email_change` ya las borra en BD; esto es
  // el cinturón de seguridad por si el trigger no estuviera presente.
  try {
    const { data: ident } = await admin.auth.admin.getUserById(emp.user_id);
    const sobrantes = (ident?.user?.identities ?? []).filter(
      (i) => ((i.identity_data?.email as string | undefined) ?? "").trim().toLowerCase() !== nuevoLogin,
    );
    for (const i of sobrantes) {
      // @ts-expect-error la firma de deleteIdentity espera el objeto identity completo
      await admin.auth.admin.deleteIdentity(i);
    }
  } catch (e) {
    console.error("[rrhh] purgar identidades del correo antiguo:", e);
  }

  // Correo al empleado avisando de que a partir de ahora entra con el nuevo.
  if (input.notificar !== false) {
    try {
      const { data: fichaMail } = await admin
        .from("empleados")
        .select("nombre, apellidos, email_personal, email_empresa, empresas(nombre)")
        .eq("id", empleadoId)
        .maybeSingle();

      // Se avisa a AMBOS buzones conocidos (el nuevo de acceso y el otro), y al
      // antiguo: si alguien pierde el acceso al viejo, el aviso le llega igual
      // al que sí controla.
      const destinos = Array.from(
        new Set(
          [
            nuevoLogin,
            anterior,
            (fichaMail?.email_personal as string | null) ?? null,
            (fichaMail?.email_empresa as string | null) ?? null,
          ]
            .map((e) => (e ?? "").trim().toLowerCase())
            .filter(Boolean),
        ),
      );

      const empresaNombre =
        ((fichaMail?.empresas as { nombre?: string } | null)?.nombre ?? "").trim() ||
        "Balles Hosteleros";
      const nombreCompleto = [fichaMail?.nombre, fichaMail?.apellidos]
        .filter(Boolean)
        .join(" ")
        .trim();

      const { sendEmail } = await import("@/lib/email/send");
      const { cambioEmailAccesoEmail } = await import(
        "@/lib/email/templates/cambio-email-acceso"
      );
      const plantilla = cambioEmailAccesoEmail({
        recipientName: nombreCompleto || "Hola",
        empresaNombre,
        anterior,
        nuevo: nuevoLogin,
      });

      for (const to of destinos) {
        await sendEmail({
          to,
          subject: plantilla.subject,
          html: plantilla.html,
          text: plantilla.text,
          empresaId: (emp.empresa_id as string | null) ?? undefined,
        });
      }
    } catch (e) {
      // El correo es un aviso: nunca rompe el cambio de acceso.
      console.error("[rrhh] correo cambio_email_acceso:", e);
    }
  }

  // Aviso in-app al propio empleado (no rompe si falla).
  if (input.notificar !== false && emp.empresa_id) {
    try {
      const { emitirNotificacion } = await import(
        "@/features/notificaciones/actions/notificaciones-actions"
      );
      await emitirNotificacion({
        empresaId: emp.empresa_id as string,
        system: true,
        tipo: "cambio_email_acceso",
        titulo: "Tu correo de acceso ha cambiado",
        mensaje:
          `A partir de ahora inicias sesión con ${nuevoLogin}. ` +
          `Tu contraseña sigue siendo la misma.`,
        segmento: { tipo: "empleados", empleadoIds: [empleadoId] },
        payload: { anterior, nuevo: nuevoLogin },
        accionUrl: "/mi-panel",
      });
    } catch (e) {
      console.error("[rrhh] aviso cambio_email_acceso:", e);
    }
  }

  return { ok: true, cambiado: true, anterior, nuevo: nuevoLogin };
}
