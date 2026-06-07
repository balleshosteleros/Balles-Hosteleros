"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import {
  diasEnAnio,
  type CalendarioVacaciones,
  type SaldoVacaciones,
} from "@/features/rrhh/data/calendarios-vacaciones";

type Sb = Awaited<ReturnType<typeof getAppContext>>["supabase"];

async function resolveEmpresaUuid(
  supabase: Sb,
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

export type BloqueoInput = {
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
};

export type CalendarioVacacionesInput = {
  nombre: string;
  descripcion: string | null;
  /** null = predeterminado (todos los años). */
  anio: number | null;
  diasTotales: number;
  bloqueos: BloqueoInput[];
};

function validarInput(input: CalendarioVacacionesInput): string | null {
  if (!input.nombre.trim()) return "El nombre es obligatorio";
  if (
    input.anio !== null &&
    (!Number.isInteger(input.anio) || input.anio < 2000 || input.anio > 2100)
  )
    return "El año no es válido";
  if (
    !Number.isInteger(input.diasTotales) ||
    input.diasTotales < 0 ||
    input.diasTotales > 366
  )
    return "Los días totales deben estar entre 0 y 366";
  for (const b of input.bloqueos) {
    if (!b.fechaInicio || !b.fechaFin) return "Cada periodo bloqueado necesita fecha de inicio y fin";
    if (b.fechaFin < b.fechaInicio)
      return "En un periodo bloqueado, la fecha de fin no puede ser anterior a la de inicio";
  }
  return null;
}

async function setBloqueos(
  supabase: Sb,
  calendarioId: string,
  bloqueos: BloqueoInput[],
) {
  await supabase
    .from("rrhh_calendario_vacaciones_bloqueos")
    .delete()
    .eq("calendario_id", calendarioId);
  if (bloqueos.length) {
    const rows = bloqueos.map((b) => ({
      calendario_id: calendarioId,
      fecha_inicio: b.fechaInicio,
      fecha_fin: b.fechaFin,
      motivo: b.motivo?.trim() || null,
    }));
    const { error } = await supabase
      .from("rrhh_calendario_vacaciones_bloqueos")
      .insert(rows);
    if (error) throw error;
  }
}

export async function listCalendariosVacaciones(
  empresaIdOrSlug: string,
): Promise<{ ok: boolean; data: CalendarioVacaciones[]; error?: string }> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };

    const { data: cals, error } = await supabase
      .from("rrhh_calendarios_vacaciones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("anio", { ascending: false })
      .order("nombre", { ascending: true });
    if (error) throw error;

    const ids = (cals ?? []).map((c) => c.id as string);
    const bloqueosPorCal = new Map<string, CalendarioVacaciones["bloqueos"]>();
    if (ids.length) {
      const { data: bloqueos } = await supabase
        .from("rrhh_calendario_vacaciones_bloqueos")
        .select("*")
        .in("calendario_id", ids)
        .order("fecha_inicio", { ascending: true });
      for (const b of bloqueos ?? []) {
        const cId = b.calendario_id as string;
        const arr = bloqueosPorCal.get(cId) ?? [];
        arr.push({
          id: b.id as string,
          fechaInicio: b.fecha_inicio as string,
          fechaFin: b.fecha_fin as string,
          motivo: (b.motivo as string | null) ?? null,
        });
        bloqueosPorCal.set(cId, arr);
      }
    }

    // Recuento de empleados por calendario (activos de la empresa).
    const { data: empleados } = await supabase
      .from("empleados")
      .select("calendario_vacaciones_id")
      .eq("empresa_id", empresaId)
      .not("calendario_vacaciones_id", "is", null);
    const countPorCal = new Map<string, number>();
    for (const e of empleados ?? []) {
      const cId = e.calendario_vacaciones_id as string;
      countPorCal.set(cId, (countPorCal.get(cId) ?? 0) + 1);
    }

    const data: CalendarioVacaciones[] = (cals ?? []).map((c) => ({
      id: c.id as string,
      nombre: c.nombre as string,
      descripcion: (c.descripcion as string | null) ?? null,
      anio: (c.anio as number | null) ?? null,
      diasTotales: c.dias_totales as number,
      activo: !!c.activo,
      bloqueos: bloqueosPorCal.get(c.id as string) ?? [],
      empleadosCount: countPorCal.get(c.id as string) ?? 0,
    }));

    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] list:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function createCalendarioVacaciones(
  empresaIdOrSlug: string,
  input: CalendarioVacacionesInput,
) {
  try {
    const { supabase, userId } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada" };

    const err = validarInput(input);
    if (err) return { ok: false, error: err };

    const { data, error } = await supabase
      .from("rrhh_calendarios_vacaciones")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        anio: input.anio,
        dias_totales: input.diasTotales,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await setBloqueos(supabase, data.id as string, input.bloqueos);

    revalidatePath("/rrhh/calendarios");
    return { ok: true, id: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCalendarioVacaciones(
  id: string,
  input: CalendarioVacacionesInput,
) {
  try {
    const { supabase } = await getAppContext();
    const err = validarInput(input);
    if (err) return { ok: false, error: err };

    const { error } = await supabase
      .from("rrhh_calendarios_vacaciones")
      .update({
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        anio: input.anio,
        dias_totales: input.diasTotales,
      })
      .eq("id", id);
    if (error) throw error;

    await setBloqueos(supabase, id, input.bloqueos);

    revalidatePath("/rrhh/calendarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCalendarioVacaciones(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("rrhh_calendarios_vacaciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/rrhh/calendarios");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] delete:", msg);
    return { ok: false, error: msg };
  }
}

export type CalendarioOpcion = {
  id: string;
  nombre: string;
  /** null = predeterminado (todos los años). */
  anio: number | null;
  diasTotales: number;
};

/** Lista ligera para asignar calendario a un empleado. */
export async function listCalendariosParaAsignar(
  empresaIdOrSlug: string,
): Promise<{ ok: boolean; data: CalendarioOpcion[] }> {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: true, data: [] };
    const { data } = await supabase
      .from("rrhh_calendarios_vacaciones")
      .select("id, nombre, anio, dias_totales")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("anio", { ascending: false })
      .order("nombre", { ascending: true });
    return {
      ok: true,
      data: (data ?? []).map((c) => ({
        id: c.id as string,
        nombre: c.nombre as string,
        anio: (c.anio as number | null) ?? null,
        diasTotales: c.dias_totales as number,
      })),
    };
  } catch {
    return { ok: false, data: [] };
  }
}

export async function asignarCalendarioEmpleado(
  empleadoId: string,
  calendarioId: string | null,
) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("empleados")
      .update({ calendario_vacaciones_id: calendarioId })
      .eq("id", empleadoId);
    if (error) throw error;
    revalidatePath(`/rrhh/empleados/${empleadoId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] asignarEmpleado:", msg);
    return { ok: false, error: msg };
  }
}

/** Asigna un calendario a todos los empleados activos de la empresa que aún no tienen ninguno. */
export async function asignarCalendarioADesasignados(
  empresaIdOrSlug: string,
  calendarioId: string,
) {
  try {
    const { supabase } = await getAppContext();
    const empresaId = await resolveEmpresaUuid(supabase, empresaIdOrSlug);
    if (!empresaId) return { ok: false, error: "Empresa no encontrada", count: 0 };
    const { data, error } = await supabase
      .from("empleados")
      .update({ calendario_vacaciones_id: calendarioId })
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .is("calendario_vacaciones_id", null)
      .select("id");
    if (error) throw error;
    revalidatePath("/rrhh/calendarios");
    return { ok: true, count: (data ?? []).length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] asignarDesasignados:", msg);
    return { ok: false, error: msg, count: 0 };
  }
}

/**
 * Calcula el saldo de vacaciones de un empleado para un año. Cuenta como
 * gastados los días naturales de sus solicitudes de vacaciones pendientes o
 * aprobadas que caen en ese año.
 */
export async function getSaldoVacacionesEmpleado(
  empleadoId: string,
  anio?: number,
): Promise<{ ok: boolean; data: SaldoVacaciones | null; error?: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data: emp } = await supabase
      .from("empleados")
      .select("user_id, empresa_id, calendario_vacaciones_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (!emp) return { ok: false, data: null, error: "Empleado no encontrado" };

    const calendarioId = (emp.calendario_vacaciones_id as string | null) ?? null;
    let calendarioNombre: string | null = null;
    let diasTotales = 0;
    let anioCalc = anio ?? new Date().getUTCFullYear();

    if (calendarioId) {
      const { data: cal } = await supabase
        .from("rrhh_calendarios_vacaciones")
        .select("nombre, anio, dias_totales")
        .eq("id", calendarioId)
        .maybeSingle();
      if (cal) {
        calendarioNombre = cal.nombre as string;
        diasTotales = cal.dias_totales as number;
        // Calendario predeterminado (anio null) → cuenta el año actual.
        if (anio == null)
          anioCalc = (cal.anio as number | null) ?? new Date().getUTCFullYear();
      }
    }

    const diasGastados = await contarDiasVacacionesUsados(
      supabase,
      emp.empresa_id as string,
      emp.user_id as string,
      anioCalc,
    );

    return {
      ok: true,
      data: {
        calendarioId,
        calendarioNombre,
        anio: anioCalc,
        diasTotales,
        diasGastados,
        diasRestantes: Math.max(0, diasTotales - diasGastados),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[calendarios-vacaciones] getSaldo:", msg);
    return { ok: false, data: null, error: msg };
  }
}

/** Suma de días naturales de vacaciones (pendientes + aprobadas) en un año. */
async function contarDiasVacacionesUsados(
  supabase: Sb,
  empresaId: string,
  userId: string,
  anio: number,
): Promise<number> {
  const inicioAnio = `${anio}-01-01`;
  const inicioAnioSig = `${anio + 1}-01-01`;
  const { data } = await supabase
    .from("solicitudes_personal")
    .select("fecha_inicio, fecha_fin")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .eq("tipo", "ausencia")
    .eq("subtipo", "vacaciones")
    .in("estado", ["pendiente", "aprobada"])
    .lt("fecha_inicio", inicioAnioSig)
    .or(`fecha_fin.gte.${inicioAnio},fecha_fin.is.null`);
  return (data ?? []).reduce(
    (acc: number, s: { fecha_inicio: string; fecha_fin: string | null }) =>
      acc + diasEnAnio(s.fecha_inicio, s.fecha_fin, anio),
    0,
  );
}
