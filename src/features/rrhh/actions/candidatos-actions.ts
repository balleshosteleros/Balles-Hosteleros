"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export async function listCandidatosReales() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("candidatos")
      .select(`
        id, empresa_id, vacante_id, empleado_id, nombre, apellidos, email,
        telefono, dni_nie, cv_url, origen, fase, estado, puntuacion, notas,
        promovido_at, created_at,
        vacantes(id, titulo, departamento_id, puesto_id)
      `)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listCandidatosReales:", err);
    return { ok: false, data: [] };
  }
}

export async function moverCandidatoFase(
  id: string,
  fase: "nuevo" | "en_progreso" | "oferta" | "seleccionado" | "descartado",
  estado: string,
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Bloquear movimiento si ya fue promovido (gestionar como "ya es empleado")
    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at, empleado_id")
      .eq("id", id)
      .single();

    if (cand?.promovido_at && fase === "descartado") {
      return {
        ok: false,
        error: "OFFBOARDING_REQUIRED",
        empleadoId: cand.empleado_id,
      } as const;
    }

    const { error } = await supabase
      .from("candidatos")
      .update({ fase, estado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, empleadoYaContratado: !!cand?.promovido_at };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function eliminarCandidato(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("candidatos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function iniciarOffboarding(empleadoId: string) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    // Buscar plantilla por defecto OFF
    const { data: plantilla } = await supabase
      .from("plantillas_boarding")
      .select("id, nombre, tareas")
      .eq("empresa_id", empresaId)
      .eq("tipo", "offboarding")
      .eq("por_defecto", true)
      .maybeSingle();

    type TareaPlantilla = { id: string; nombre: string; orden: number };
    const tareasIniciales = ((plantilla?.tareas ?? []) as TareaPlantilla[]).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      orden: t.orden,
      completada: false,
      fechaCompletado: null as string | null,
    }));

    const { data: proceso, error } = await supabase
      .from("procesos_boarding")
      .insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        plantilla_id: plantilla?.id ?? null,
        plantilla_nombre: plantilla?.nombre ?? "OFF-BOARDING",
        tipo: "offboarding",
        estado: "activo",
        tareas: tareasIniciales,
        iniciado_por: user.id,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Marcar empleado como Baja temporal (constraint exige fecha_baja para cualquier baja)
    await supabase
      .from("empleados")
      .update({
        estado: "Baja temporal",
        fecha_baja: new Date().toISOString().slice(0, 10),
      })
      .eq("id", empleadoId)
      .eq("empresa_id", empresaId);

    return { ok: true, procesoId: proceso.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
