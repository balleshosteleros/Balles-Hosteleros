"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/rrhh/services/empleados-core";
import { revalidatePath } from "next/cache";

export interface RrhhConfig {
  /** Departamento cuyos empleados validan a los empleados de área operativa. */
  validadorDeptoOperativaId: string | null;
  /** Departamento cuyos empleados validan a los empleados de área administrativa. */
  validadorDeptoAdministrativaId: string | null;
  /** Si al validador le aparece una tarea en Mi Panel mientras tenga pendientes. */
  tareasValidadorActivo: boolean;
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
      .select("validador_depto_operativa_id, validador_depto_administrativa_id, tareas_validador_activo")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;

    return {
      ok: true,
      data: {
        validadorDeptoOperativaId: (data?.validador_depto_operativa_id as string | null) ?? null,
        validadorDeptoAdministrativaId: (data?.validador_depto_administrativa_id as string | null) ?? null,
        tareasValidadorActivo: data ? (data.tareas_validador_activo as boolean) !== false : true,
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
}) {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    await requireAdminUser({ empresaIds: [empresaId] });

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
        },
        { onConflict: "empresa_id" },
      );
    if (error) throw error;

    revalidatePath("/ajustes");
    revalidatePath("/rrhh/empleados");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] saveRrhhConfig:", msg);
    return { ok: false, error: msg };
  }
}
