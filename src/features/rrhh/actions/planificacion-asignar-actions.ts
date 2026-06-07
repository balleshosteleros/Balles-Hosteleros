"use server";

// Escrituras del planner por día concreto (tabla rrhh_planificacion).
// El cliente ya conoce los empleados destino (una celda de empleado → [id];
// una cabecera de departamento → todos los ids de ese grupo), así que las
// actions aceptan SIEMPRE un array de empleadoIds y no resuelven departamentos.

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";

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

/** "YYYY-MM-DD" + n días → "YYYY-MM-DD" (mediodía local para evitar DST). */
function addDiasISO(fechaISO: string, n: number): string {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Asigna un turno suelto a uno o varios empleados en un día concreto. */
export async function asignarTurnoDia(
  empresaIdOrSlug: string,
  empleadoIds: string[],
  fechaISO: string,
  turnoId: string,
) {
  try {
    const { supabase, userId } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };
    const ids = Array.from(new Set(empleadoIds.filter(Boolean)));
    if (ids.length === 0 || !turnoId || !fechaISO)
      return { ok: false, error: "Datos incompletos" };

    const rows = ids.map((empleado_id) => ({
      empresa_id: empresaId,
      empleado_id,
      fecha: fechaISO,
      turno_id: turnoId,
      origen: "manual" as const,
      created_by: userId,
    }));
    const { error } = await supabase
      .from("rrhh_planificacion")
      .upsert(rows, {
        onConflict: "empleado_id,fecha,turno_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;

    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[planificacion] asignarTurnoDia:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Asigna un patrón a uno o varios empleados: 7 días seguidos desde fechaInicio
 * (día soltado = día 0 del patrón). Usa la semana de orden mínimo como
 * representativa; cada día con turno genera una fila origen='patron'.
 */
export async function asignarPatronDia(
  empresaIdOrSlug: string,
  empleadoIds: string[],
  fechaInicioISO: string,
  patronId: string,
) {
  try {
    const { supabase, userId } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };
    const ids = Array.from(new Set(empleadoIds.filter(Boolean)));
    if (ids.length === 0 || !patronId || !fechaInicioISO)
      return { ok: false, error: "Datos incompletos" };

    // Semana representativa del patrón (menor orden).
    const { data: semanas } = await supabase
      .from("rrhh_patron_semanas")
      .select("orden, dias")
      .eq("patron_id", patronId)
      .order("orden", { ascending: true })
      .limit(1);
    const dias = (semanas?.[0]?.dias as (string | null)[] | undefined) ?? [];
    if (dias.length === 0)
      return { ok: false, error: "El patrón no tiene días configurados" };

    const rows: {
      empresa_id: string;
      empleado_id: string;
      fecha: string;
      turno_id: string;
      origen: "patron";
      patron_id: string;
      created_by: string | null;
    }[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const turnoId = dias[offset] ?? null;
      if (!turnoId) continue;
      const fecha = addDiasISO(fechaInicioISO, offset);
      for (const empleado_id of ids) {
        rows.push({
          empresa_id: empresaId,
          empleado_id,
          fecha,
          turno_id: turnoId,
          origen: "patron",
          patron_id: patronId,
          created_by: userId,
        });
      }
    }
    if (rows.length === 0)
      return { ok: false, error: "El patrón no tiene turnos en sus 7 días" };

    const { error } = await supabase
      .from("rrhh_planificacion")
      .upsert(rows, {
        onConflict: "empleado_id,fecha,turno_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;

    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[planificacion] asignarPatronDia:", msg);
    return { ok: false, error: msg };
  }
}

/** Quita una asignación concreta de la rejilla (fila de rrhh_planificacion). */
export async function quitarAsignacionDia(asignacionId: string) {
  try {
    const { supabase } = await getAppContext();
    if (!asignacionId) return { ok: false, error: "Falta el id" };
    const { error } = await supabase
      .from("rrhh_planificacion")
      .delete()
      .eq("id", asignacionId);
    if (error) throw error;
    revalidatePath("/rrhh/horarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[planificacion] quitarAsignacionDia:", msg);
    return { ok: false, error: msg };
  }
}
