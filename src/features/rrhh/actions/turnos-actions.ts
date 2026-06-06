"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import type {
  Turno,
  TurnoTramo,
  TurnoTono,
} from "@/features/rrhh/data/horarios";

type Result<T> = { ok: true; data: T } | { ok: false; data: T; error: string };

function rowToTurno(r: Record<string, unknown>): Turno {
  return {
    id: r.id as string,
    nombre: r.nombre as string,
    codigo: r.codigo as string,
    tramos: (r.tramos as TurnoTramo[]) ?? [],
    color: (r.color as TurnoTono) ?? "stone",
    activo: !!r.activo,
    centro: (r.centro as string | null) ?? undefined,
    departamento: (r.departamento as string | null) ?? undefined,
  };
}

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

export async function listTurnos(empresaIdOrSlug: string): Promise<Result<Turno[]>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("rrhh_turnos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToTurno) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] listTurnos:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export type TurnoInput = {
  nombre: string;
  codigo: string;
  tramos: TurnoTramo[];
  color: TurnoTono;
  departamento?: string | null;
  activo?: boolean;
};

function makeTurnoId(empresaId: string) {
  return `t-${empresaId.slice(0, 4)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export async function createTurno(
  empresaIdOrSlug: string,
  input: TurnoInput,
) {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    const id = makeTurnoId(empresaId);
    const { error } = await supabase.from("rrhh_turnos").insert({
      id,
      empresa_id: empresaId,
      nombre: input.nombre.trim(),
      codigo: input.codigo.trim().toUpperCase(),
      tramos: input.tramos,
      color: input.color,
      departamento: input.departamento?.trim() || null,
      activo: input.activo ?? true,
    });
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] createTurno:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateTurno(id: string, patch: Partial<TurnoInput>) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.nombre !== undefined) payload.nombre = patch.nombre.trim();
    if (patch.codigo !== undefined) payload.codigo = patch.codigo.trim().toUpperCase();
    if (patch.tramos !== undefined) payload.tramos = patch.tramos;
    if (patch.color !== undefined) payload.color = patch.color;
    if (patch.departamento !== undefined)
      payload.departamento = patch.departamento?.trim() || null;
    if (patch.activo !== undefined) payload.activo = patch.activo;

    const { error } = await supabase.from("rrhh_turnos").update(payload).eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] updateTurno:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteTurno(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.from("rrhh_turnos").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] deleteTurno:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Asignación DIRECTA turno↔empleado (turnos sueltos) ──────────────────
// Complementa al modelo por patrones. Un empleado que solo trabaja un turno
// concreto se asigna aquí; los multi-turno siguen vía patrón.

export type EmpleadoBasico = {
  id: string;
  nombre: string;
  apellidos: string | null;
};

// Empleados asignados DIRECTAMENTE a cada turno de la empresa.
// Devuelve Record<turnoId, EmpleadoBasico[]>.
export async function getEmpleadosDirectosPorTurno(
  empresaIdOrSlug: string,
): Promise<Result<Record<string, EmpleadoBasico[]>>> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: {} };

    const { data, error } = await supabase
      .from("rrhh_turno_empleados")
      .select("turno_id, empleado_id, empleados(id, nombre, apellidos)")
      .eq("empresa_id", empresaId);
    if (error) throw error;

    const acc: Record<string, EmpleadoBasico[]> = {};
    for (const row of data ?? []) {
      const turnoId = row.turno_id as string;
      const empRel = row.empleados as
        | { id: string; nombre: string | null; apellidos: string | null }
        | Array<{ id: string; nombre: string | null; apellidos: string | null }>
        | null;
      const emp = Array.isArray(empRel) ? empRel[0] : empRel;
      if (!emp) continue;
      const arr = acc[turnoId] ?? [];
      arr.push({
        id: emp.id,
        nombre: emp.nombre ?? "",
        apellidos: emp.apellidos ?? null,
      });
      acc[turnoId] = arr;
    }
    for (const turnoId of Object.keys(acc)) {
      acc[turnoId].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }
    return { ok: true, data: acc };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] getEmpleadosDirectosPorTurno:", msg);
    return { ok: false, data: {}, error: msg };
  }
}

// Reemplaza el conjunto completo de empleados asignados directamente a un turno.
export async function setEmpleadosDirectosTurno(
  empresaIdOrSlug: string,
  turnoId: string,
  empleadoIds: string[],
) {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    const idsUnicos = Array.from(new Set(empleadoIds.filter(Boolean)));

    // Borra los que ya no estén seleccionados.
    const delQuery = supabase
      .from("rrhh_turno_empleados")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("turno_id", turnoId);
    const { error: errDel } = idsUnicos.length
      ? await delQuery.not("empleado_id", "in", `(${idsUnicos.join(",")})`)
      : await delQuery;
    if (errDel) throw errDel;

    // Inserta los nuevos (idempotente vía UNIQUE(turno_id, empleado_id)).
    if (idsUnicos.length) {
      const rows = idsUnicos.map((empleadoId) => ({
        empresa_id: empresaId,
        turno_id: turnoId,
        empleado_id: empleadoId,
      }));
      const { error: errIns } = await supabase
        .from("rrhh_turno_empleados")
        .upsert(rows, { onConflict: "turno_id,empleado_id", ignoreDuplicates: true });
      if (errIns) throw errIns;
    }

    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[turnos] setEmpleadosDirectosTurno:", msg);
    return { ok: false, error: msg };
  }
}
