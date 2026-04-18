"use server";

import { crearTareaAsignada } from "@/features/tareas/actions/tareas-actions";
import type { ActionResult } from "../types";

/**
 * Crea una tarea persistente asignada al usuario responsable de la fase.
 * Wrapper sobre el módulo compartido de tareas.
 */
export async function crearTareaFase(input: {
  user_id: string;
  empresa_id: string;
  titulo: string;
  descripcion?: string | null;
  receta_id: string;
  prioridad?: "alta" | "media" | "baja";
}): Promise<ActionResult<{ id: string }>> {
  const res = await crearTareaAsignada({
    user_id: input.user_id,
    empresa_id: input.empresa_id,
    titulo: input.titulo,
    descripcion: input.descripcion ?? null,
    prioridad: input.prioridad ?? "media",
    tipo: "nueva_receta_fase",
    ref_tabla: "nuevas_recetas",
    ref_id: input.receta_id,
    link_url: `/cocina/nuevas-recetas?id=${input.receta_id}`,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { id: res.data.id } };
}
