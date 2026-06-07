"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import type { Cuadrante } from "@/features/rrhh/data/cuadrantes";

type Result<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

async function resolveEmpresaUuid(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  idOrSlug: string,
): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug)) return idOrSlug;
  const { data } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", idOrSlug)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Empleados (del ámbito local + departamentos) que tienen turno. El cuadrante
 * es un ámbito automático: no se etiqueta a nadie a mano. "Tener turno" =
 * estar asignado a algún turno directamente o a través de un patrón.
 */
type AmbitoEmpleados = {
  /** empleadoId -> departamentoId (puede ser null). */
  empleados: { id: string; departamentoId: string | null; localIdDefecto: string | null }[];
  /** empleadoId -> Set(localId) de la tabla puente empleado_locales. */
  localesPorEmpleado: Map<string, Set<string>>;
  /** empleados con turno (directo o patrón). */
  conTurno: Set<string>;
};

async function cargarAmbito(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
): Promise<AmbitoEmpleados> {
  const { data: empleadosRows } = await supabase
    .from("empleados")
    .select("id, departamento_id, local_id")
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo");

  const empleados = (empleadosRows ?? []).map((e) => ({
    id: e.id as string,
    departamentoId: (e.departamento_id as string | null) ?? null,
    localIdDefecto: (e.local_id as string | null) ?? null,
  }));
  const empleadoIds = empleados.map((e) => e.id);

  const localesPorEmpleado = new Map<string, Set<string>>();
  const conTurno = new Set<string>();
  if (empleadoIds.length === 0) {
    return { empleados, localesPorEmpleado, conTurno };
  }

  const { data: patronesRows } = await supabase
    .from("rrhh_patrones")
    .select("id")
    .eq("empresa_id", empresaId);
  const patronIds = (patronesRows ?? []).map((p) => p.id as string);

  const [{ data: locRows }, { data: turnoEmp }, patronEmp] = await Promise.all([
    supabase
      .from("empleado_locales")
      .select("empleado_id, local_id")
      .in("empleado_id", empleadoIds),
    supabase
      .from("rrhh_turno_empleados")
      .select("empleado_id")
      .eq("empresa_id", empresaId),
    patronIds.length
      ? supabase
          .from("rrhh_patron_empleados")
          .select("empleado_id")
          .in("patron_id", patronIds)
      : Promise.resolve({ data: [] as { empleado_id: string }[] }),
  ]);

  for (const row of locRows ?? []) {
    const empId = row.empleado_id as string;
    const set = localesPorEmpleado.get(empId) ?? new Set<string>();
    set.add(row.local_id as string);
    localesPorEmpleado.set(empId, set);
  }
  for (const row of turnoEmp ?? []) conTurno.add(row.empleado_id as string);
  for (const row of (patronEmp.data ?? []) as { empleado_id: string }[]) {
    conTurno.add(row.empleado_id);
  }

  return { empleados, localesPorEmpleado, conTurno };
}

function contarEmpleados(
  ambito: AmbitoEmpleados,
  localId: string | null,
  departamentoIds: string[],
): number {
  const deptSet = new Set(departamentoIds);
  let total = 0;
  for (const emp of ambito.empleados) {
    if (!emp.departamentoId || !deptSet.has(emp.departamentoId)) continue;
    if (!ambito.conTurno.has(emp.id)) continue;
    if (localId) {
      const enLocal =
        ambito.localesPorEmpleado.get(emp.id)?.has(localId) ||
        emp.localIdDefecto === localId;
      if (!enLocal) continue;
    }
    total += 1;
  }
  return total;
}

export async function listCuadrantes(
  empresaIdOrSlug: string,
): Promise<Result<Cuadrante[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };

    const { data: cuadrantes, error } = await supabase
      .from("rrhh_cuadrantes")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;

    const ids = (cuadrantes ?? []).map((c) => c.id as string);
    const depsPorCuadrante = new Map<string, string[]>();
    if (ids.length) {
      const { data: depRows } = await supabase
        .from("rrhh_cuadrante_departamentos")
        .select("cuadrante_id, departamento_id")
        .in("cuadrante_id", ids);
      for (const row of depRows ?? []) {
        const cId = row.cuadrante_id as string;
        const arr = depsPorCuadrante.get(cId) ?? [];
        arr.push(row.departamento_id as string);
        depsPorCuadrante.set(cId, arr);
      }
    }

    const { data: locales } = await supabase
      .from("locales")
      .select("id, nombre")
      .eq("empresa_id", empresaId);
    const localNombre = new Map(
      (locales ?? []).map((l) => [l.id as string, l.nombre as string]),
    );

    const ambito = await cargarAmbito(supabase, empresaId);

    const data: Cuadrante[] = (cuadrantes ?? []).map((c) => {
      const localId = (c.local_id as string | null) ?? null;
      const departamentoIds = depsPorCuadrante.get(c.id as string) ?? [];
      return {
        id: c.id as string,
        nombre: c.nombre as string,
        localId,
        localNombre: localId ? localNombre.get(localId) ?? null : null,
        departamentoIds,
        activo: !!c.activo,
        empleadosCount: contarEmpleados(ambito, localId, departamentoIds),
      };
    });

    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cuadrantes] listCuadrantes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

/**
 * Garantiza un cuadrante por cada local de la empresa. Si un local no tiene
 * cuadrante propio, crea uno con el mismo nombre que el local y ámbito = todos
 * los departamentos de la empresa (así el cuadrante recoge todos los turnos ya
 * creados). Idempotente: solo crea los que falten. Devuelve la lista resultante.
 */
export async function ensureCuadrantesPorLocal(
  empresaIdOrSlug: string,
): Promise<Result<Cuadrante[]>> {
  try {
    const { supabase, userId } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };

    const [{ data: locales }, { data: cuadrantes }, { data: departamentos }] =
      await Promise.all([
        supabase.from("locales").select("id, nombre").eq("empresa_id", empresaId),
        supabase
          .from("rrhh_cuadrantes")
          .select("id, local_id")
          .eq("empresa_id", empresaId),
        supabase.from("departamentos").select("id").eq("empresa_id", empresaId),
      ]);

    const departamentoIds = (departamentos ?? []).map((d) => d.id as string);
    const localesConCuadrante = new Set(
      (cuadrantes ?? [])
        .map((c) => c.local_id as string | null)
        .filter((id): id is string => !!id),
    );

    const faltantes = (locales ?? []).filter(
      (l) => !localesConCuadrante.has(l.id as string),
    );

    for (const local of faltantes) {
      const { data: nuevo, error } = await supabase
        .from("rrhh_cuadrantes")
        .insert({
          empresa_id: empresaId,
          nombre: (local.nombre as string).trim(),
          local_id: local.id as string,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (departamentoIds.length) {
        await setDepartamentos(supabase, nuevo.id as string, departamentoIds);
      }
    }

    if (faltantes.length) revalidatePath("/rrhh/horarios");
    return listCuadrantes(empresaIdOrSlug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cuadrantes] ensureCuadrantesPorLocal:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export type CuadranteInput = {
  nombre: string;
  /** null = todos los locales de la empresa. */
  localId: string | null;
  departamentoIds: string[];
};

async function setDepartamentos(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  cuadranteId: string,
  departamentoIds: string[],
) {
  await supabase
    .from("rrhh_cuadrante_departamentos")
    .delete()
    .eq("cuadrante_id", cuadranteId);
  const ids = Array.from(new Set(departamentoIds.filter(Boolean)));
  if (ids.length) {
    const rows = ids.map((departamento_id) => ({
      cuadrante_id: cuadranteId,
      departamento_id,
    }));
    const { error } = await supabase
      .from("rrhh_cuadrante_departamentos")
      .insert(rows);
    if (error) throw error;
  }
}

export async function createCuadrante(
  empresaIdOrSlug: string,
  input: CuadranteInput,
) {
  try {
    const { supabase, userId } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    const nombre = input.nombre.trim();
    const departamentoIds = Array.from(new Set(input.departamentoIds.filter(Boolean)));
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    if (departamentoIds.length === 0)
      return { ok: false, error: "Selecciona al menos un departamento" };

    const { data, error } = await supabase
      .from("rrhh_cuadrantes")
      .insert({
        empresa_id: empresaId,
        nombre,
        local_id: input.localId ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await setDepartamentos(supabase, data.id as string, departamentoIds);

    revalidatePath("/rrhh/horarios");
    return { ok: true, id: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cuadrantes] createCuadrante:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCuadrante(
  id: string,
  input: CuadranteInput,
) {
  try {
    const { supabase } = await getAppContext();

    const nombre = input.nombre.trim();
    const departamentoIds = Array.from(new Set(input.departamentoIds.filter(Boolean)));
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
    if (departamentoIds.length === 0)
      return { ok: false, error: "Selecciona al menos un departamento" };

    const { error } = await supabase
      .from("rrhh_cuadrantes")
      .update({ nombre, local_id: input.localId ?? null })
      .eq("id", id);
    if (error) throw error;

    await setDepartamentos(supabase, id, departamentoIds);

    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cuadrantes] updateCuadrante:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCuadrante(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("rrhh_cuadrantes").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[cuadrantes] deleteCuadrante:", msg);
    return { ok: false, error: msg };
  }
}
