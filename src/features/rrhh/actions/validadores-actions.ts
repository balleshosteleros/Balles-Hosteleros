"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/rrhh/services/empleados-core";
import { revalidatePath } from "next/cache";

export type AreaEmpleado = "OPERATIVA" | "ADMINISTRATIVA";

export interface ValidadorElegible {
  id: string; // empleados.id
  nombre: string;
  apellidos: string;
  nombreCompleto: string;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function getEmpresaIdDeEmpleado(admin: AdminClient, empleadoId: string) {
  const { data } = await admin
    .from("empleados")
    .select("empresa_id")
    .eq("id", empleadoId)
    .maybeSingle();
  return (data?.empresa_id as string | null) ?? null;
}

/** Empleados activos de un departamento concreto de la empresa (candidatos a validar). */
async function empleadosDeDepartamento(
  admin: AdminClient,
  empresaId: string,
  departamentoId: string,
  excludeEmpleadoId?: string,
): Promise<ValidadorElegible[]> {
  const { data } = await admin
    .from("empleados")
    .select("id, nombre, apellidos")
    .eq("empresa_id", empresaId)
    .eq("departamento_id", departamentoId)
    .eq("estado", "Activo");
  return (data ?? [])
    .filter((e) => e.id !== excludeEmpleadoId)
    .map((e) => {
      const nombre = (e.nombre as string) ?? "";
      const apellidos = (e.apellidos as string | null) ?? "";
      return { id: e.id as string, nombre, apellidos, nombreCompleto: `${nombre} ${apellidos}`.trim() };
    })
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));
}

/** Departamento configurado como validador para un área (empresa_rrhh_config). */
async function deptoValidadorDeArea(
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
  return area === "OPERATIVA"
    ? (data.validador_depto_operativa_id as string | null) ?? null
    : (data.validador_depto_administrativa_id as string | null) ?? null;
}

export interface ValidadoresElegiblesResult {
  ok: boolean;
  data: ValidadorElegible[];
  /** Área del empleado validado, derivada de su departamento. */
  area: AreaEmpleado | null;
  /** Nombre del departamento del que salen los validadores (para el aviso de la UI). */
  departamentoNombre: string | null;
  error?: string;
}

/**
 * Candidatos a validador (de trabajo y de ausencias) de UN empleado.
 *
 * La elegibilidad va por DEPARTAMENTO según el ÁREA del empleado validado:
 * cada empresa configura en Ajustes → RRHH qué departamento valida a su área
 * operativa y cuál a la administrativa (default: operativa→RRHH,
 * administrativa→Dirección). Los candidatos son los empleados activos de ese
 * departamento. Si el departamento no tiene empleados, la lista va vacía.
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

    const { data: emp, error: empErr } = await admin
      .from("empleados")
      .select("id, empresa_id, departamento_id, departamentos(area)")
      .eq("id", input.empleadoId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!emp?.empresa_id) return vacio("Empleado no encontrado.");
    await requireAdminUser({ empresaIds: [emp.empresa_id as string] });

    const areaRaw = (emp.departamentos as { area?: string | null } | null)?.area ?? null;
    const area: AreaEmpleado | null =
      areaRaw === "OPERATIVA" ? "OPERATIVA" : areaRaw === "ADMINISTRATIVA" ? "ADMINISTRATIVA" : null;
    if (!area) {
      return { ...vacio(), area: null, departamentoNombre: null };
    }

    const deptoId = await deptoValidadorDeArea(admin, emp.empresa_id as string, area);
    if (!deptoId) return { ...vacio(), area, departamentoNombre: null };

    const { data: depto } = await admin
      .from("departamentos")
      .select("nombre")
      .eq("id", deptoId)
      .maybeSingle();

    const data = await empleadosDeDepartamento(
      admin, emp.empresa_id as string, deptoId, input.empleadoId,
    );
    return { ok: true, data, area, departamentoNombre: (depto?.nombre as string | null) ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] listValidadoresElegibles:", msg);
    return vacio(msg);
  }
}

/**
 * Asigna los dos validadores (trabajo y ausencias) de un empleado. Es
 * obligatorio fijar AMBOS: ningún empleado puede quedar sin validador al cargo.
 * Solo se aceptan validadores del departamento que corresponde al área del
 * empleado (según empresa_rrhh_config) y distintos del propio empleado.
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
          ? `Los validadores deben pertenecer al departamento ${depto}.`
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
 * Empleados que tienen a `empleadoId` como validador (de trabajo y/o ausencias),
 * junto con los reemplazos posibles. Se usa antes de desactivar a un empleado:
 * si tiene dependientes, hay que reasignarlos para que nadie quede huérfano.
 *
 * Los reemplazos son los compañeros activos del MISMO departamento que el
 * empleado a desactivar (son los únicos válidos para esos dependientes, porque
 * la elegibilidad va por departamento).
 */
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

    const { data: emp, error: empErr } = await admin
      .from("empleados")
      .select("empresa_id, departamento_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!emp?.empresa_id) return { ok: false, dependientes: [], reemplazos: [], error: "Empleado no encontrado." };
    const empresaId = emp.empresa_id as string;
    await requireAdminUser({ empresaIds: [empresaId] });

    const { data: deps, error } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, validador_trabajo_id, validador_ausencias_id")
      .eq("empresa_id", empresaId)
      .or(`validador_trabajo_id.eq.${empleadoId},validador_ausencias_id.eq.${empleadoId}`);
    if (error) throw error;

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

    const reemplazos = emp.departamento_id
      ? await empleadosDeDepartamento(admin, empresaId, emp.departamento_id as string, empleadoId)
      : [];
    return { ok: true, dependientes, reemplazos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] getDependientesValidador:", msg);
    return { ok: false, dependientes: [], reemplazos: [], error: msg };
  }
}

/**
 * Reasigna a un sustituto todos los empleados que tenían a `empleadoId` como
 * validador (en el campo que correspondiera) y, a continuación, desactiva al
 * empleado con su fecha de baja. Garantiza que ningún puesto de validador queda
 * huérfano al dar de baja. El sustituto debe ser del mismo departamento.
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

    const { data: emp } = await admin
      .from("empleados")
      .select("empresa_id, departamento_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (!emp?.empresa_id) return { ok: false, error: "Empleado no encontrado." };
    const empresaId = emp.empresa_id as string;
    await requireAdminUser({ empresaIds: [empresaId] });

    const reemplazos = emp.departamento_id
      ? await empleadosDeDepartamento(admin, empresaId, emp.departamento_id as string, empleadoId)
      : [];
    if (!reemplazos.some((v) => v.id === sustitutoId)) {
      return { ok: false, error: "El sustituto debe ser del mismo departamento que el empleado." };
    }

    // 1) Reasignar dependientes al sustituto (cada campo por separado).
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

    // 2) Desactivar al empleado (trigger sincroniza profiles.estado_acceso).
    const { error: errE } = await admin
      .from("empleados")
      .update({ estado: "Desactivado", fecha_baja: fechaBaja })
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
