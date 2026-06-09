"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/rrhh/services/empleados-core";
import { revalidatePath } from "next/cache";

export type AreaEmpleado = "OPERATIVA" | "ADMINISTRATIVA";

const COMBINING_MARKS = /[̀-ͯ]/g;
function norm(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase().trim();
}

type PermisoModulo = { modulo: string; ver?: boolean; editar?: boolean };
type AdminClient = ReturnType<typeof createAdminClient>;

export interface ValidadorElegible {
  id: string; // empleados.id
  nombre: string;
  apellidos: string;
  nombreCompleto: string;
}

type EmpleadoConRol = ValidadorElegible & { rolNorm: string };

async function getEmpresaIdDeEmpleado(admin: AdminClient, empleadoId: string) {
  const { data } = await admin
    .from("empleados")
    .select("empresa_id")
    .eq("id", empleadoId)
    .maybeSingle();
  return (data?.empresa_id as string | null) ?? null;
}

/** Área del empleado (de su departamento) + su empresa. */
async function areaDeEmpleado(
  admin: AdminClient,
  empleadoId: string,
): Promise<{ empresaId: string | null; area: AreaEmpleado | null }> {
  const { data } = await admin
    .from("empleados")
    .select("empresa_id, departamentos(area)")
    .eq("id", empleadoId)
    .maybeSingle();
  const a = (data?.departamentos as { area?: string | null } | null)?.area ?? null;
  return {
    empresaId: (data?.empresa_id as string | null) ?? null,
    area: a === "OPERATIVA" ? "OPERATIVA" : a === "ADMINISTRATIVA" ? "ADMINISTRATIVA" : null,
  };
}

/** Empleados activos de la empresa con su rol (rol_label) normalizado. */
async function empleadosActivosConRol(
  admin: AdminClient,
  empresaId: string,
  excludeEmpleadoId?: string,
): Promise<EmpleadoConRol[]> {
  const { data: emps } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, user_id")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");
  const userIds = (emps ?? []).map((e) => e.user_id as string).filter(Boolean);
  const rolPorUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await admin
      .from("usuarios")
      .select("user_id, rol_label")
      .in("user_id", userIds);
    for (const p of profs ?? []) {
      rolPorUser.set(p.user_id as string, norm((p.rol_label as string | null) ?? ""));
    }
  }
  return (emps ?? [])
    .filter((e) => e.id !== excludeEmpleadoId)
    .map((e) => {
      const nombre = (e.nombre as string) ?? "";
      const apellidos = (e.apellidos as string | null) ?? "";
      return {
        id: e.id as string,
        nombre,
        apellidos,
        nombreCompleto: `${nombre} ${apellidos}`.trim(),
        rolNorm: rolPorUser.get(e.user_id as string) ?? "",
      };
    });
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

/** Nombre del departamento configurado como validador de un área. */
async function deptoNombreValidadorDeArea(
  admin: AdminClient,
  empresaId: string,
  area: AreaEmpleado,
): Promise<string | null> {
  const { data } = await admin
    .from("empresa_rrhh_config")
    .select("validador_depto_operativa_id, validador_depto_administrativa_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data) return null;
  const deptoId =
    area === "OPERATIVA"
      ? (data.validador_depto_operativa_id as string | null)
      : (data.validador_depto_administrativa_id as string | null);
  if (!deptoId) return null;
  const { data: d } = await admin
    .from("departamentos")
    .select("nombre")
    .eq("id", deptoId)
    .maybeSingle();
  return (d?.nombre as string | null) ?? null;
}

export interface ValidadoresElegiblesResult {
  ok: boolean;
  data: ValidadorElegible[];
  /** Área del empleado validado, derivada de su departamento. */
  area: AreaEmpleado | null;
  /** Departamento configurado para esa área (al que el validador debe tener acceso por rol). */
  departamentoNombre: string | null;
  error?: string;
}

/**
 * Candidatos a validador (de trabajo y de ausencias) de UN empleado.
 *
 * Elegibilidad: el empleado validado tiene un ÁREA (de su departamento). La
 * empresa configura en Ajustes → RRHH qué departamento valida a cada área
 * (default operativa→RRHH, administrativa→Dirección). Son candidatos los
 * empleados activos cuyo ROL da acceso (ver) a ese departamento/módulo. Es
 * decir, no hace falta pertenecer al departamento: basta con que el rol lo
 * incluya (p. ej. el rol Gerencia con acceso a RRHH valida a los operativos).
 */
export async function listValidadoresElegibles(input: {
  empleadoId: string;
}): Promise<ValidadoresElegiblesResult> {
  const vacio = (error?: string): ValidadoresElegiblesResult => ({
    ok: !error, data: [], area: null, departamentoNombre: null, error,
  });
  try {
    let admin;
    try { admin = createAdminClient(); }
    catch { return vacio("Supabase admin no configurado."); }

    const { empresaId, area } = await areaDeEmpleado(admin, input.empleadoId);
    if (!empresaId) return vacio("Empleado no encontrado.");
    await requireAdminUser({ empresaIds: [empresaId] });
    if (!area) return { ...vacio(), area: null, departamentoNombre: null };

    const moduloNombre = await deptoNombreValidadorDeArea(admin, empresaId, area);
    if (!moduloNombre) return { ...vacio(), area, departamentoNombre: null };

    const [rolesSet, candidatos] = await Promise.all([
      rolesConAccesoAModulo(admin, empresaId, moduloNombre),
      empleadosActivosConRol(admin, empresaId, input.empleadoId),
    ]);

    const data: ValidadorElegible[] = candidatos
      .filter((e) => rolesSet.has(e.rolNorm))
      .map(({ id, nombre, apellidos, nombreCompleto }) => ({ id, nombre, apellidos, nombreCompleto }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));

    return { ok: true, data, area, departamentoNombre: moduloNombre };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] listValidadoresElegibles:", msg);
    return vacio(msg);
  }
}

/**
 * Asigna los dos validadores (trabajo y ausencias) de un empleado. Es
 * obligatorio fijar AMBOS. Solo se aceptan validadores elegibles (cuyo rol da
 * acceso al departamento configurado para el área del empleado) y distintos
 * del propio empleado.
 */
export async function setValidadoresEmpleado(input: {
  empleadoId: string;
  validadorTrabajoId: string | null;
  validadorAusenciasId: string | null;
}) {
  try {
    const { empleadoId, validadorTrabajoId, validadorAusenciasId } = input;
    if (!validadorTrabajoId || !validadorAusenciasId) {
      return { ok: false, error: "Debes asignar un validador de trabajo y uno de ausencias." };
    }
    if (validadorTrabajoId === empleadoId || validadorAusenciasId === empleadoId) {
      return { ok: false, error: "Un empleado no puede ser su propio validador." };
    }

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const empresaId = await getEmpresaIdDeEmpleado(admin, empleadoId);
    if (!empresaId) return { ok: false, error: "Empleado no encontrado." };
    await requireAdminUser({ empresaIds: [empresaId] });

    const elegibles = await listValidadoresElegibles({ empleadoId });
    const idsElegibles = new Set(elegibles.data.map((v) => v.id));
    if (!idsElegibles.has(validadorTrabajoId) || !idsElegibles.has(validadorAusenciasId)) {
      const depto = elegibles.departamentoNombre;
      return {
        ok: false,
        error: depto
          ? `Los validadores deben tener acceso a ${depto} en su rol.`
          : "Los validadores no son válidos para el área de este empleado.",
      };
    }

    const { error } = await admin
      .from("empleados")
      .update({ validador_trabajo_id: validadorTrabajoId, validador_ausencias_id: validadorAusenciasId })
      .eq("id", empleadoId);
    if (error) throw error;

    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${empleadoId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] setValidadoresEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

export interface DependienteValidador {
  empleadoId: string;
  nombreCompleto: string;
  comoTrabajo: boolean;
  comoAusencias: boolean;
}

/**
 * Dependientes (empleados que tienen a `empleadoId` como validador) + reemplazos
 * posibles. Reemplazos = empleados activos elegibles para validar a TODOS esos
 * dependientes (su rol da acceso al departamento configurado para el área de
 * cada dependiente). Se usa antes de desactivar a un empleado para no dejar a
 * nadie sin validador.
 */
async function computeDependientesYReemplazos(
  admin: AdminClient,
  empleadoId: string,
  empresaId: string,
): Promise<{ dependientes: DependienteValidador[]; reemplazos: ValidadorElegible[] }> {
  const { data: deps } = await admin
    .from("empleados")
    .select("id, nombre, apellidos, validador_trabajo_id, validador_ausencias_id, departamentos(area)")
    .eq("empresa_id", empresaId)
    .or(`validador_trabajo_id.eq.${empleadoId},validador_ausencias_id.eq.${empleadoId}`);

  const dependientes: DependienteValidador[] = (deps ?? []).map((e) => {
    const nombre = (e.nombre as string) ?? "";
    const apellidos = (e.apellidos as string | null) ?? "";
    return {
      empleadoId: e.id as string,
      nombreCompleto: `${nombre} ${apellidos}`.trim(),
      comoTrabajo: e.validador_trabajo_id === empleadoId,
      comoAusencias: e.validador_ausencias_id === empleadoId,
    };
  });

  // Áreas distintas de los dependientes → módulos requeridos al sustituto.
  const areas = new Set<AreaEmpleado>();
  for (const e of deps ?? []) {
    const a = (e.departamentos as { area?: string | null } | null)?.area ?? null;
    if (a === "OPERATIVA" || a === "ADMINISTRATIVA") areas.add(a);
  }

  let reemplazos: ValidadorElegible[] = [];
  if (areas.size > 0) {
    const modulos = (
      await Promise.all([...areas].map((a) => deptoNombreValidadorDeArea(admin, empresaId, a)))
    ).filter((m): m is string => Boolean(m));
    const rolesSets = await Promise.all(
      modulos.map((m) => rolesConAccesoAModulo(admin, empresaId, m)),
    );
    const candidatos = await empleadosActivosConRol(admin, empresaId, empleadoId);
    reemplazos = candidatos
      .filter((c) => rolesSets.every((set) => set.has(c.rolNorm)))
      .map(({ id, nombre, apellidos, nombreCompleto }) => ({ id, nombre, apellidos, nombreCompleto }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));
  }

  return { dependientes, reemplazos };
}

export async function getDependientesValidador(
  empleadoId: string,
): Promise<{
  ok: boolean;
  dependientes: DependienteValidador[];
  reemplazos: ValidadorElegible[];
  error?: string;
}> {
  try {
    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, dependientes: [], reemplazos: [], error: "Supabase admin no configurado." }; }

    const empresaId = await getEmpresaIdDeEmpleado(admin, empleadoId);
    if (!empresaId) return { ok: false, dependientes: [], reemplazos: [], error: "Empleado no encontrado." };
    await requireAdminUser({ empresaIds: [empresaId] });

    const { dependientes, reemplazos } = await computeDependientesYReemplazos(admin, empleadoId, empresaId);
    return { ok: true, dependientes, reemplazos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] getDependientesValidador:", msg);
    return { ok: false, dependientes: [], reemplazos: [], error: msg };
  }
}

/**
 * Reasigna a un sustituto todos los empleados que tenían a `empleadoId` como
 * validador y desactiva al empleado con su fecha de baja. El sustituto debe ser
 * elegible para todos los dependientes (rol con acceso al departamento de su área).
 */
export async function reasignarValidadorYDesactivar(input: {
  empleadoId: string;
  sustitutoId: string;
  fechaBaja: string;
}) {
  try {
    const { empleadoId, sustitutoId, fechaBaja } = input;
    if (!fechaBaja) return { ok: false, error: "La fecha de baja es obligatoria al desactivar." };
    if (!sustitutoId) return { ok: false, error: "Debes elegir un sustituto." };
    if (sustitutoId === empleadoId) return { ok: false, error: "El sustituto debe ser otro empleado." };

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const empresaId = await getEmpresaIdDeEmpleado(admin, empleadoId);
    if (!empresaId) return { ok: false, error: "Empleado no encontrado." };
    await requireAdminUser({ empresaIds: [empresaId] });

    const { reemplazos } = await computeDependientesYReemplazos(admin, empleadoId, empresaId);
    if (!reemplazos.some((v) => v.id === sustitutoId)) {
      return { ok: false, error: "El sustituto no es válido para los empleados que dependen de este validador." };
    }

    const { error: errT } = await admin
      .from("empleados")
      .update({ validador_trabajo_id: sustitutoId })
      .eq("empresa_id", empresaId)
      .eq("validador_trabajo_id", empleadoId);
    if (errT) throw errT;
    const { error: errA } = await admin
      .from("empleados")
      .update({ validador_ausencias_id: sustitutoId })
      .eq("empresa_id", empresaId)
      .eq("validador_ausencias_id", empleadoId);
    if (errA) throw errA;

    const { error: errE } = await admin
      .from("empleados")
      .update({ estado: "Inactivo", fecha_baja: fechaBaja })
      .eq("id", empleadoId);
    if (errE) throw errE;

    revalidatePath("/rrhh/empleados");
    revalidatePath(`/rrhh/empleados/${empleadoId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] reasignarValidadorYDesactivar:", msg);
    return { ok: false, error: msg };
  }
}
