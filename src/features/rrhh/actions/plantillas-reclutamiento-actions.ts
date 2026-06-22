"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

// NOTA: las plantillas de EMAIL las gestiona
// `reclutamiento-email-plantillas-actions.ts` (1 fila por empresa×estado).
// Las plantillas de CUESTIONARIO (modelo de quiz con scoring) las gestiona la
// feature de cuestionarios (ver `src/features/rrhh/data/cuestionario-vacante.ts`
// + tabla `reclutamiento_plantillas_cuestionario`). Aquí solo viven las
// plantillas de ESTADOS.

// ─────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────
export interface PlantillaEstadoItem {
  key: string;
  label: string;
  color: string;
  fase: "seleccion" | "formacion" | "descartado";
  orden: number;
  /** Email (biblioteca suelta) que se envía por defecto al pasar a este estado. */
  email_plantilla_id?: string | null;
}

export interface PlantillaEstadoRow {
  id: string;
  nombre: string;
  es_predeterminada: boolean;
  estados: PlantillaEstadoItem[];
  activa: boolean;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// PLANTILLAS DE ESTADOS
// ─────────────────────────────────────────────────────────────────────────
export async function listPlantillasEstado() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as PlantillaEstadoRow[] };
    const { data, error } = await supabase
      .from("reclutamiento_plantillas_estado")
      .select("id,nombre,es_predeterminada,estados,activa,updated_at")
      .eq("empresa_id", empresaId)
      .order("es_predeterminada", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as PlantillaEstadoRow[] };
  } catch (err) {
    console.error("[rrhh] listPlantillasEstado:", err);
    return { ok: false, data: [] as PlantillaEstadoRow[] };
  }
}

export async function createPlantillaEstado(input: {
  nombre: string;
  estados: PlantillaEstadoItem[];
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre?.trim()) return { ok: false, error: "El nombre es obligatorio" };
    if (!input.estados?.length) return { ok: false, error: "Añade al menos un estado" };
    const { data, error } = await supabase
      .from("reclutamiento_plantillas_estado")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        es_predeterminada: false,
        estados: input.estados,
        activa: true,
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createPlantillaEstado:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePlantillaEstado(
  id: string,
  input: Partial<{ nombre: string; estados: PlantillaEstadoItem[]; activa: boolean }>,
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("reclutamiento_plantillas_estado")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updatePlantillaEstado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePlantillaEstado(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    // No se permite borrar la plantilla predeterminada.
    const { data: row } = await supabase
      .from("reclutamiento_plantillas_estado")
      .select("es_predeterminada")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (row?.es_predeterminada) {
      return { ok: false, error: "No se puede eliminar la plantilla predeterminada" };
    }
    const { error } = await supabase
      .from("reclutamiento_plantillas_estado")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deletePlantillaEstado:", msg);
    return { ok: false, error: msg };
  }
}
