"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { CronogramaOperativo } from "../hooks/useCronogramasOperativos";
import { revalidatePath } from "next/cache";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Inserta la misma tarea en N empresas. Todas las filas comparten una misma
 * `clave_tarea` (UUID generado en cliente), de modo que ediciones/eliminaciones
 * posteriores puedan localizar el grupo de filas equivalentes entre empresas.
 *
 * Si `parentClaveTarea` se pasa, la nueva subtarea queda enlazada por clave
 * con la subtarea equivalente del padre en cada empresa correspondiente.
 */
export async function addTareaMultiEmpresa(payload: {
  empresaIds: string[];
  base: Partial<CronogramaOperativo>;
  /** clave_tarea del padre, si es subtarea. La nueva subtarea recibirá su propia clave_tarea. */
  parentClaveTarea?: string | null;
}): Promise<Result<{ claveTarea: string; insertedIds: string[] }>> {
  const { empresaIds, base, parentClaveTarea } = payload;

  if (empresaIds.length === 0) {
    return { ok: false, error: "Debes seleccionar al menos una empresa." };
  }

  const supabase = await createServerClient();

  // Si la tarea es subtarea, necesitamos saber el id real del padre en cada empresa.
  let parentIdByEmpresa: Map<string, string> = new Map();
  if (parentClaveTarea) {
    const { data: padres, error: padresErr } = await supabase
      .from("cronogramas_operativos")
      .select("id, empresa_id")
      .eq("clave_tarea", parentClaveTarea)
      .in("empresa_id", empresaIds);
    if (padresErr) return { ok: false, error: padresErr.message };
    parentIdByEmpresa = new Map(
      (padres ?? []).map((p: { id: string; empresa_id: string }) => [p.empresa_id, p.id]),
    );
  }

  // Generamos una clave_tarea en cliente para que todas las filas la compartan.
  const claveTarea = crypto.randomUUID();

  // Construimos el batch de inserts (una fila por empresa)
  const rows = empresaIds
    .map((empresaId) => {
      const parent_id = parentClaveTarea
        ? parentIdByEmpresa.get(empresaId) ?? null
        : (base.parent_id ?? null);
      // Si la tarea es subtarea pero el padre no existe en esta empresa, saltamos.
      if (parentClaveTarea && !parent_id) return null;
      return {
        ...base,
        empresa_id: empresaId,
        parent_id,
        clave_tarea: claveTarea,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return { ok: false, error: "Ninguna de las empresas seleccionadas tiene la tarea padre." };
  }

  const { data, error } = await supabase
    .from("cronogramas_operativos")
    .insert(rows)
    .select("id");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/direccion/cronogramas");
  return {
    ok: true,
    data: {
      claveTarea,
      insertedIds: (data ?? []).map((r: { id: string }) => r.id),
    },
  };
}

/**
 * Aplica el mismo patch a todas las filas con `claveTarea` dentro de las
 * empresas seleccionadas. Las empresas no marcadas conservan su versión.
 */
export async function updateTareaMultiEmpresa(payload: {
  claveTarea: string;
  empresaIds: string[];
  patch: Partial<CronogramaOperativo>;
}): Promise<Result<{ updated: number }>> {
  const { claveTarea, empresaIds, patch } = payload;

  if (empresaIds.length === 0) {
    return { ok: false, error: "Debes seleccionar al menos una empresa." };
  }

  const supabase = await createServerClient();

  // No permitimos pisar empresa_id ni clave_tarea por accidente
  const { empresa_id: _ignoreEmpresa, clave_tarea: _ignoreClave, id: _ignoreId, ...safePatch } = patch as Record<string, unknown>;

  const { data, error } = await supabase
    .from("cronogramas_operativos")
    .update(safePatch)
    .eq("clave_tarea", claveTarea)
    .in("empresa_id", empresaIds)
    .select("id, empresa_id, tarea, empleados_asignados");

  if (error) return { ok: false, error: error.message };

  // PRP-045 Fase 6: push "cronograma_cambiado" a los empleados asignados.
  // Best-effort: no bloqueamos la respuesta si el envío falla.
  try {
    const { sendPushToUser } = await import(
      "@/features/mi-panel/mobile/lib/push-server"
    );
    const enviados = new Set<string>();
    for (const row of data ?? []) {
      const userIds = (row.empleados_asignados as string[] | null) ?? [];
      for (const userId of userIds) {
        if (!userId || enviados.has(`${userId}:${row.empresa_id}`)) continue;
        enviados.add(`${userId}:${row.empresa_id}`);
        await sendPushToUser({
          userId,
          empresaId: row.empresa_id as string,
          eventType: "cronograma_cambiado",
          payload: {
            title: "Tu cronograma ha cambiado",
            body: row.tarea
              ? `Cambios en "${row.tarea}". Revisa tu cronograma.`
              : "Hay cambios en tu cronograma de tareas.",
            url: "/m/cronograma",
            tag: `cronograma-${row.id}`,
            data: { url: "/m/cronograma" },
          },
        });
      }
    }
  } catch (e) {
    console.error("[cronograma] push cronograma_cambiado:", e);
  }

  revalidatePath("/direccion/cronogramas");
  return { ok: true, data: { updated: (data ?? []).length } };
}

/**
 * Elimina las filas con `claveTarea` en las empresas seleccionadas.
 * Las subtareas (filas con `parent_id` apuntando a las eliminadas) caen por
 * cascade FK si está configurado. Si no, las borramos en una segunda pasada.
 */
export async function deleteTareaMultiEmpresa(payload: {
  claveTarea: string;
  empresaIds: string[];
}): Promise<Result<{ deleted: number }>> {
  const { claveTarea, empresaIds } = payload;

  if (empresaIds.length === 0) {
    return { ok: false, error: "Debes seleccionar al menos una empresa." };
  }

  const supabase = await createServerClient();

  // Buscamos los ids de las filas a borrar para arrastrar subtareas explícitamente
  const { data: target, error: targetErr } = await supabase
    .from("cronogramas_operativos")
    .select("id")
    .eq("clave_tarea", claveTarea)
    .in("empresa_id", empresaIds);

  if (targetErr) return { ok: false, error: targetErr.message };

  const ids = (target ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) {
    return { ok: true, data: { deleted: 0 } };
  }

  // Borramos subtareas primero (cualquier fila con parent_id en `ids`)
  const { error: subsErr } = await supabase
    .from("cronogramas_operativos")
    .delete()
    .in("parent_id", ids);
  if (subsErr) return { ok: false, error: subsErr.message };

  const { error: delErr } = await supabase
    .from("cronogramas_operativos")
    .delete()
    .in("id", ids);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/direccion/cronogramas");
  return { ok: true, data: { deleted: ids.length } };
}

/**
 * Elimina TODO el cronograma de un rol en las empresas seleccionadas.
 * Útil para el botón "papelera" junto al selector de puesto.
 */
export async function deleteCronogramaRolMultiEmpresa(payload: {
  rol: string;
  empresaIds: string[];
}): Promise<Result<{ deleted: number }>> {
  const { rol, empresaIds } = payload;

  if (empresaIds.length === 0) {
    return { ok: false, error: "Debes seleccionar al menos una empresa." };
  }

  const supabase = await createServerClient();

  const { data: target, error: targetErr } = await supabase
    .from("cronogramas_operativos")
    .select("id")
    .eq("rol", rol)
    .in("empresa_id", empresaIds);

  if (targetErr) return { ok: false, error: targetErr.message };

  const ids = (target ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return { ok: true, data: { deleted: 0 } };

  const { error: delErr } = await supabase
    .from("cronogramas_operativos")
    .delete()
    .in("id", ids);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/direccion/cronogramas");
  return { ok: true, data: { deleted: ids.length } };
}
