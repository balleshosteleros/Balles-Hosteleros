"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/rrhh/services/empleados-core";
import { revalidatePath } from "next/cache";

/**
 * VALIDADOR DE SOLICITUDES = UN DEPARTAMENTO, NO UNA PERSONA.
 *
 * Cada puesto define qué departamento valida las solicitudes de quien lo ocupe,
 * y el empleado hereda ese departamento al ser contratado. Puede aprobar o
 * denegar cualquier empleado activo cuyo ROL le dé acceso a ese departamento,
 * que es como funciona el acceso en todo el software (por permiso configurado
 * en el rol, no por pertenencia al departamento).
 *
 * Antes había dos validadores persona (trabajo y ausencias). Se unificaron en
 * uno solo y por departamento: así una baja no deja solicitudes sin nadie que
 * las resuelva ni obliga a reasignar validador empleado por empleado.
 */

export type AreaEmpleado = "OPERATIVA" | "ADMINISTRATIVA";

const COMBINING_MARKS = /[̀-ͯ]/g;
function norm(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase().trim();
}

type PermisoModulo = { modulo: string; ver?: boolean; editar?: boolean };
type AdminClient = ReturnType<typeof createAdminClient>;

export interface DepartamentoOpcion {
  id: string;
  nombre: string;
}

/** Roles (normalizados) cuyo permiso incluye `moduloNombre` con ver: true. */
async function rolesConAccesoAModulo(
  admin: AdminClient,
  empresaId: string,
  moduloNombre: string,
): Promise<Set<string>> {
  const target = norm(moduloNombre);
  const { data: roles } = await admin
    .from("empresa_roles")
    .select("nombre, permisos")
    .eq("empresa_id", empresaId);
  const set = new Set<string>();
  for (const r of roles ?? []) {
    const permisos = (r.permisos ?? []) as PermisoModulo[];
    if (permisos.some((p) => p.ver && norm(p.modulo) === target)) {
      set.add(norm((r.nombre as string) ?? ""));
    }
  }
  return set;
}

/**
 * Departamentos de la empresa, para elegir cuál valida en un puesto.
 */
export async function listDepartamentosValidadores(
  empresaId: string,
): Promise<{ ok: boolean; data: DepartamentoOpcion[]; error?: string }> {
  try {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, data: [], error: "Supabase admin no configurado." };
    }
    if (!empresaId) return { ok: true, data: [] };
    await requireAdminUser({ empresaIds: [empresaId] });

    const { data } = await admin
      .from("departamentos")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .order("nombre");

    return {
      ok: true,
      data: (data ?? []).map((d) => ({ id: d.id as string, nombre: (d.nombre as string) ?? "" })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] listDepartamentosValidadores:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export interface ValidadorSolicitudesVista {
  /** Departamento que valida sus solicitudes. */
  departamentoNombre: string | null;
  /** Empleados activos que hoy pueden aprobarle (su rol da acceso a ese departamento). */
  quienesPuedenValidar: string[];
}

/**
 * Lectura del validador de un empleado: qué departamento le valida y quiénes
 * pueden aprobarle hoy. Es solo lectura; el departamento se cambia en el puesto.
 */
export async function getValidadorSolicitudesEmpleado(
  empleadoId: string,
): Promise<{ ok: boolean; data: ValidadorSolicitudesVista }> {
  const vacio: ValidadorSolicitudesVista = { departamentoNombre: null, quienesPuedenValidar: [] };
  try {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, data: vacio };
    }

    const { data: emp } = await admin
      .from("empleados")
      .select("empresa_id, validador_departamento_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (!emp) return { ok: false, data: vacio };

    const empresaId = emp.empresa_id as string;
    await requireAdminUser({ empresaIds: [empresaId] });

    const deptoId = (emp.validador_departamento_id as string | null) ?? null;
    if (!deptoId) return { ok: true, data: vacio };

    const { data: depto } = await admin
      .from("departamentos")
      .select("nombre")
      .eq("id", deptoId)
      .maybeSingle();
    const departamentoNombre = (depto?.nombre as string | null) ?? null;
    if (!departamentoNombre) return { ok: true, data: vacio };

    const quienesPuedenValidar = await nombresQuePuedenValidar(
      admin,
      empresaId,
      departamentoNombre,
    );

    return { ok: true, data: { departamentoNombre, quienesPuedenValidar } };
  } catch (err) {
    console.error("[rrhh] getValidadorSolicitudesEmpleado:", err);
    return { ok: false, data: vacio };
  }
}

/** Nombres de los empleados activos cuyo rol da acceso a `departamentoNombre`. */
async function nombresQuePuedenValidar(
  admin: AdminClient,
  empresaId: string,
  departamentoNombre: string,
): Promise<string[]> {
  const rolesSet = await rolesConAccesoAModulo(admin, empresaId, departamentoNombre);
  if (rolesSet.size === 0) return [];

  const { data: emps } = await admin
    .from("empleados")
    .select("nombre, apellidos, user_id")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");

  const userIds = (emps ?? []).map((e) => e.user_id as string).filter(Boolean);
  if (userIds.length === 0) return [];

  const { data: profs } = await admin
    .from("usuarios")
    .select("user_id, rol_label")
    .in("user_id", userIds);
  const rolPorUser = new Map<string, string>();
  for (const p of profs ?? []) {
    rolPorUser.set(p.user_id as string, norm((p.rol_label as string | null) ?? ""));
  }

  return (emps ?? [])
    .filter((e) => rolesSet.has(rolPorUser.get(e.user_id as string) ?? ""))
    .map((e) => `${e.nombre ?? ""} ${(e.apellidos as string | null) ?? ""}`.trim())
    .sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * ¿El usuario puede validar las solicitudes de este empleado? Lo puede hacer si
 * su rol da acceso al departamento validador del solicitante.
 */
export async function puedeValidarSolicitudesDe(input: {
  userId: string;
  empleadoSolicitanteId: string;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: solicitante } = await admin
      .from("empleados")
      .select("empresa_id, validador_departamento_id")
      .eq("id", input.empleadoSolicitanteId)
      .maybeSingle();
    const deptoId = (solicitante?.validador_departamento_id as string | null) ?? null;
    const empresaId = (solicitante?.empresa_id as string | null) ?? null;
    if (!deptoId || !empresaId) return false;

    const { data: depto } = await admin
      .from("departamentos")
      .select("nombre")
      .eq("id", deptoId)
      .maybeSingle();
    const deptoNombre = (depto?.nombre as string | null) ?? null;
    if (!deptoNombre) return false;

    const [rolesSet, { data: prof }] = await Promise.all([
      rolesConAccesoAModulo(admin, empresaId, deptoNombre),
      admin.from("usuarios").select("rol_label").eq("user_id", input.userId).maybeSingle(),
    ]);
    return rolesSet.has(norm((prof?.rol_label as string | null) ?? ""));
  } catch (err) {
    console.error("[rrhh] puedeValidarSolicitudesDe:", err);
    return false;
  }
}

/**
 * `empleados.id` de quienes pueden validar las solicitudes de este empleado:
 * los activos cuyo rol da acceso a su departamento validador. Se usa para
 * avisarles a todos de que hay una solicitud pendiente.
 */
export async function empleadosQuePuedenValidarA(input: {
  empleadoUserId: string;
  empresaId: string;
}): Promise<string[]> {
  try {
    const admin = createAdminClient();

    const { data: solicitante } = await admin
      .from("empleados")
      .select("validador_departamento_id")
      .eq("user_id", input.empleadoUserId)
      .eq("empresa_id", input.empresaId)
      .maybeSingle();
    const deptoId = (solicitante?.validador_departamento_id as string | null) ?? null;
    if (!deptoId) return [];

    const { data: depto } = await admin
      .from("departamentos")
      .select("nombre")
      .eq("id", deptoId)
      .maybeSingle();
    const deptoNombre = (depto?.nombre as string | null) ?? null;
    if (!deptoNombre) return [];

    const rolesSet = await rolesConAccesoAModulo(admin, input.empresaId, deptoNombre);
    if (rolesSet.size === 0) return [];

    const { data: emps } = await admin
      .from("empleados")
      .select("id, user_id")
      .eq("empresa_id", input.empresaId)
      .eq("estado", "Activo");

    const userIds = (emps ?? []).map((e) => e.user_id as string).filter(Boolean);
    if (userIds.length === 0) return [];

    const { data: profs } = await admin
      .from("usuarios")
      .select("user_id, rol_label")
      .in("user_id", userIds);
    const rolPorUser = new Map<string, string>();
    for (const p of profs ?? []) {
      rolPorUser.set(p.user_id as string, norm((p.rol_label as string | null) ?? ""));
    }

    return (emps ?? [])
      .filter((e) => rolesSet.has(rolPorUser.get(e.user_id as string) ?? ""))
      .map((e) => e.id as string);
  } catch (err) {
    console.error("[rrhh] empleadosQuePuedenValidarA:", err);
    return [];
  }
}

/**
 * `user_id` de los empleados a los que este usuario puede validar solicitudes:
 * aquellos cuyo departamento validador está entre los que su rol le da acceso.
 *
 * Se usa para marcar qué filas puede resolver en la lista de solicitudes y para
 * contar sus pendientes, con una sola pasada en vez de una consulta por fila.
 */
export async function userIdsQuePuedoValidar(input: {
  userId: string;
  empresaId: string;
}): Promise<string[]> {
  try {
    const admin = createAdminClient();

    const { data: prof } = await admin
      .from("usuarios")
      .select("rol_label")
      .eq("user_id", input.userId)
      .maybeSingle();
    const miRol = norm((prof?.rol_label as string | null) ?? "");
    if (!miRol) return [];

    // Departamentos a los que mi rol da acceso (ver).
    const { data: roles } = await admin
      .from("empresa_roles")
      .select("nombre, permisos")
      .eq("empresa_id", input.empresaId);
    const misModulos = new Set<string>();
    for (const r of roles ?? []) {
      if (norm((r.nombre as string) ?? "") !== miRol) continue;
      for (const p of (r.permisos ?? []) as PermisoModulo[]) {
        if (p.ver) misModulos.add(norm(p.modulo));
      }
    }
    if (misModulos.size === 0) return [];

    const { data: deptos } = await admin
      .from("departamentos")
      .select("id, nombre")
      .eq("empresa_id", input.empresaId);
    const deptosQueValido = (deptos ?? [])
      .filter((d) => misModulos.has(norm((d.nombre as string) ?? "")))
      .map((d) => d.id as string);
    if (deptosQueValido.length === 0) return [];

    const { data: emps } = await admin
      .from("empleados")
      .select("user_id")
      .eq("empresa_id", input.empresaId)
      .in("validador_departamento_id", deptosQueValido);

    // Nadie se valida a sí mismo, con UNA excepción: DIRECCIÓN. Es el puesto
    // más alto, así que no hay nadie por encima que le apruebe; si se le
    // bloqueara, no podría pedir vacaciones nunca. Cualquier otro que pertenezca
    // al departamento que le valida (p. ej. alguien de RRHH que vea el módulo
    // RECURSOS HUMANOS) sí queda excluido: ahí sí hay quien lo resuelva.
    // Se filtra en memoria y no con `neq` porque un user_id nulo descartaría
    // filas por el tratamiento de NULL en PostgREST.
    const validoDireccion = (deptos ?? []).some(
      (d) => deptosQueValido.includes(d.id as string) && norm((d.nombre as string) ?? "") === norm("DIRECCIÓN"),
    );
    return (emps ?? [])
      .map((e) => e.user_id as string)
      .filter(Boolean)
      .filter((uid) => validoDireccion || uid !== input.userId);
  } catch (err) {
    console.error("[rrhh] userIdsQuePuedoValidar:", err);
    return [];
  }
}

/**
 * Fija el departamento que valida las solicitudes de quienes ocupen un puesto.
 * Los empleados que ya ocupan ese puesto se actualizan también, para que el
 * cambio surta efecto sin tener que recontratar a nadie.
 */
export async function setValidadorDepartamentoPuesto(input: {
  puestoId: string;
  departamentoId: string | null;
}): Promise<{ ok: boolean; empleadosActualizados?: number; error?: string }> {
  try {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, error: "Supabase admin no configurado." };
    }

    const { data: puesto } = await admin
      .from("puestos")
      .select("empresa_id, nombre")
      .eq("id", input.puestoId)
      .maybeSingle();
    const empresaId = (puesto?.empresa_id as string | null) ?? null;
    if (!empresaId) return { ok: false, error: "Puesto no encontrado." };
    await requireAdminUser({ empresaIds: [empresaId] });

    if (input.departamentoId) {
      const { data: depto } = await admin
        .from("departamentos")
        .select("empresa_id")
        .eq("id", input.departamentoId)
        .maybeSingle();
      if ((depto?.empresa_id as string | null) !== empresaId) {
        return { ok: false, error: "El departamento no pertenece a esta empresa." };
      }
    }

    const { error: errP } = await admin
      .from("puestos")
      .update({ validador_departamento_id: input.departamentoId })
      .eq("id", input.puestoId);
    if (errP) throw errP;

    const { data: afectados, error: errE } = await admin
      .from("empleados")
      .update({ validador_departamento_id: input.departamentoId })
      .eq("empresa_id", empresaId)
      .eq("puesto_id", input.puestoId)
      .select("id");
    if (errE) throw errE;

    revalidatePath("/rrhh/puestos");
    revalidatePath("/rrhh/empleados");
    return { ok: true, empleadosActualizados: (afectados ?? []).length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] setValidadorDepartamentoPuesto:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Desactiva a un empleado con su fecha de baja.
 *
 * Con el validador por departamento ya no hay que reasignar nada: quien valida
 * es el departamento, no esta persona, así que darle de baja no deja ninguna
 * solicitud huérfana.
 */
export async function desactivarEmpleadoConFechaBaja(input: {
  empleadoId: string;
  fechaBaja: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { empleadoId, fechaBaja } = input;
    if (!fechaBaja) return { ok: false, error: "La fecha de baja es obligatoria al desactivar." };

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, error: "Supabase admin no configurado." };
    }

    const { data: previo } = await admin
      .from("empleados")
      .select("empresa_id, estado")
      .eq("id", empleadoId)
      .maybeSingle();
    const empresaId = (previo?.empresa_id as string | null) ?? null;
    if (!empresaId) return { ok: false, error: "Empleado no encontrado." };
    await requireAdminUser({ empresaIds: [empresaId] });

    const estadoAnterior = (previo?.estado as string | null) ?? null;

    const { error: errE } = await admin
      .from("empleados")
      .update({ estado: "Inactivo", fecha_baja: fechaBaja })
      .eq("id", empleadoId);
    if (errE) throw errE;

    if (estadoAnterior !== "Inactivo") {
      const { registrarMovimientoEstado } = await import(
        "@/features/rrhh/actions/empleado-estado-historial-actions"
      );
      await registrarMovimientoEstado({
        empleadoId,
        accion: "Baja",
        estadoAnterior,
        estadoNuevo: "Inactivo",
        fechaEfectiva: fechaBaja,
        origen: "ficha",
      });
    }

    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${empleadoId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] desactivarEmpleadoConFechaBaja:", msg);
    return { ok: false, error: msg };
  }
}
