"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/rrhh/services/empleados-core";
import { revalidatePath } from "next/cache";
import {
  VACACIONES_REGLAS_DEFAULT,
  PERMISO_REGLAS_DEFAULT,
} from "@/features/mi-panel/lib/vacaciones-reglas";

export interface RrhhConfig {
  /** Departamento cuyos empleados validan a los empleados de área operativa. */
  validadorDeptoOperativaId: string | null;
  /** Departamento cuyos empleados validan a los empleados de área administrativa. */
  validadorDeptoAdministrativaId: string | null;
  /** Si al validador le aparece una tarea en Mi Panel mientras tenga pendientes. */
  tareasValidadorActivo: boolean;
  /**
   * Día ISO (1=lunes … 7=domingo) en que deben empezar las vacaciones.
   * null = la empresa no exige ningún día concreto.
   */
  vacacionesDiaInicio: number | null;
  /** Mínimo de días naturales por solicitud de vacaciones. null = sin mínimo. */
  vacacionesDiasMin: number | null;
  /** Máximo de días naturales por solicitud de vacaciones. null = sin máximo. */
  vacacionesDiasMax: number | null;
  /** Mínimo de días naturales por solicitud de permiso. null = sin mínimo. */
  permisoDiasMin: number | null;
  /** Máximo de días naturales por solicitud de permiso. null = sin máximo. */
  permisoDiasMax: number | null;
}

/** Convierte a entero dentro de rango, o null si no es un valor usable. */
function enteroEnRango(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= min && i <= max ? i : null;
}

/** Lee la configuración RRHH de la empresa activa (validadores por área). */
export async function getRrhhConfig(): Promise<{ ok: boolean; data?: RrhhConfig; error?: string }> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const { data, error } = await admin
      .from("empresa_rrhh_config")
      .select(
        "validador_depto_operativa_id, validador_depto_administrativa_id, tareas_validador_activo, vacaciones_dia_inicio, vacaciones_dias_min, vacaciones_dias_max, permiso_dias_min, permiso_dias_max",
      )
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;

    // Sin fila todavía → los defaults del negocio (lunes, semanas de 7 días).
    // Con fila, un NULL guardado significa "esa regla no se exige".
    return {
      ok: true,
      data: {
        validadorDeptoOperativaId: (data?.validador_depto_operativa_id as string | null) ?? null,
        validadorDeptoAdministrativaId: (data?.validador_depto_administrativa_id as string | null) ?? null,
        tareasValidadorActivo: data ? (data.tareas_validador_activo as boolean) !== false : true,
        vacacionesDiaInicio: data
          ? enteroEnRango(data.vacaciones_dia_inicio, 1, 7)
          : VACACIONES_REGLAS_DEFAULT.diaInicio,
        vacacionesDiasMin: data
          ? enteroEnRango(data.vacaciones_dias_min, 1, 366)
          : VACACIONES_REGLAS_DEFAULT.diasMin,
        vacacionesDiasMax: data
          ? enteroEnRango(data.vacaciones_dias_max, 1, 366)
          : VACACIONES_REGLAS_DEFAULT.diasMax,
        // Permiso: sin límite mientras la empresa no configure nada.
        permisoDiasMin: data
          ? enteroEnRango(data.permiso_dias_min, 1, 366)
          : PERMISO_REGLAS_DEFAULT.diasMin,
        permisoDiasMax: data
          ? enteroEnRango(data.permiso_dias_max, 1, 366)
          : PERMISO_REGLAS_DEFAULT.diasMax,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] getRrhhConfig:", msg);
    return { ok: false, error: msg };
  }
}

/** Guarda qué departamento valida a cada área en la empresa activa. */
export async function saveRrhhConfig(input: {
  validadorDeptoOperativaId: string | null;
  validadorDeptoAdministrativaId: string | null;
  tareasValidadorActivo: boolean;
  vacacionesDiaInicio: number | null;
  vacacionesDiasMin: number | null;
  vacacionesDiasMax: number | null;
  permisoDiasMin: number | null;
  permisoDiasMax: number | null;
}) {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    await requireAdminUser({ empresaIds: [empresaId] });

    // Saneamos aquí para no depender solo del CHECK de la base de datos: así el
    // mensaje que ve quien configura explica el problema, no un error de SQL.
    const diaInicio = enteroEnRango(input.vacacionesDiaInicio, 1, 7);
    const diasMin = enteroEnRango(input.vacacionesDiasMin, 1, 366);
    const diasMax = enteroEnRango(input.vacacionesDiasMax, 1, 366);
    if (input.vacacionesDiasMin != null && diasMin == null) {
      return { ok: false, error: "El mínimo de días de vacaciones debe estar entre 1 y 366." };
    }
    if (input.vacacionesDiasMax != null && diasMax == null) {
      return { ok: false, error: "El máximo de días de vacaciones debe estar entre 1 y 366." };
    }
    if (diasMin != null && diasMax != null && diasMax < diasMin) {
      return {
        ok: false,
        error: "El máximo de días de vacaciones no puede ser menor que el mínimo.",
      };
    }

    // Mismas comprobaciones para permiso. Se sanean aquí (y no solo con el
    // CHECK de la base de datos) para que el mensaje explique el problema.
    const permisoMin = enteroEnRango(input.permisoDiasMin, 1, 366);
    const permisoMax = enteroEnRango(input.permisoDiasMax, 1, 366);
    if (input.permisoDiasMin != null && permisoMin == null) {
      return { ok: false, error: "El mínimo de días de permiso debe estar entre 1 y 366." };
    }
    if (input.permisoDiasMax != null && permisoMax == null) {
      return { ok: false, error: "El máximo de días de permiso debe estar entre 1 y 366." };
    }
    if (permisoMin != null && permisoMax != null && permisoMax < permisoMin) {
      return {
        ok: false,
        error: "El máximo de días de permiso no puede ser menor que el mínimo.",
      };
    }

    let admin;
    try { admin = createAdminClient(); }
    catch { return { ok: false, error: "Supabase admin no configurado." }; }

    const { error } = await admin
      .from("empresa_rrhh_config")
      .upsert(
        {
          empresa_id: empresaId,
          validador_depto_operativa_id: input.validadorDeptoOperativaId,
          validador_depto_administrativa_id: input.validadorDeptoAdministrativaId,
          tareas_validador_activo: input.tareasValidadorActivo,
          vacaciones_dia_inicio: diaInicio,
          vacaciones_dias_min: diasMin,
          vacaciones_dias_max: diasMax,
          permiso_dias_min: permisoMin,
          permiso_dias_max: permisoMax,
        },
        { onConflict: "empresa_id" },
      );
    if (error) throw error;

    revalidatePath("/ajustes");
    revalidatePath("/rrhh/empleados");
    // El empleado ve estas reglas al pedir vacaciones: que las note al momento.
    revalidatePath("/rrhh/solicitudes");
    revalidatePath("/mi-panel");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] saveRrhhConfig:", msg);
    return { ok: false, error: msg };
  }
}
