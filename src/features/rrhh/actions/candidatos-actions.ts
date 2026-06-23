"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  normalizarNombre,
  normalizarNombreOrNull,
} from "@/shared/lib/normalizar-nombre";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/** Nombre legible del usuario (nombre+apellidos → full_name → email). */
async function nombreUsuarioActual(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, apellidos, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "Usuario";
  const completo = [data.nombre, data.apellidos].filter(Boolean).join(" ").trim();
  return completo || (data.full_name as string | null) || (data.email as string | null) || "Usuario";
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

export async function createCandidato(input: {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  vacante_id: string | null;
  origen: string;
  notas: string;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" } as const;

    const { error } = await supabase.from("candidatos").insert({
      empresa_id: empresaId,
      vacante_id: input.vacante_id,
      nombre: normalizarNombre(input.nombre),
      apellidos: normalizarNombreOrNull(input.apellidos),
      email: input.email.trim(),
      telefono: input.telefono.trim() || null,
      origen: input.origen,
      notas: input.notas.trim() || null,
      fase: "seleccion",
      estado: "nuevo",
    });

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true } as const;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg } as const;
  }
}

export async function moverCandidatoFase(
  id: string,
  fase:
    | "seleccion"
    | "formacion"
    | "descartado"
    // Aliases legacy aceptados por compat con datos antiguos de BD.
    | "nuevo"
    | "en_progreso"
    | "oferta"
    | "seleccionado",
  estado: string,
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Bloquear movimiento si ya fue promovido (gestionar como "ya es empleado")
    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at, empleado_id, fase, estado")
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

    // Registra la actividad (apartado "Actividad" de la ficha): quién, cuándo y
    // de qué estado a cuál. El flag email_enviado lo marca después el envío del
    // correo de fase, si lo hubo. No bloquea el movimiento si fallara.
    if (user && cand && (cand.fase !== fase || cand.estado !== estado)) {
      const usuarioNombre = await nombreUsuarioActual(supabase, user.id);
      const { error: histErr } = await supabase.from("candidato_historial").insert({
        empresa_id: empresaId,
        candidato_id: id,
        fase_anterior: cand.fase ?? null,
        estado_anterior: cand.estado ?? null,
        fase_nueva: fase,
        estado_nuevo: estado,
        usuario_id: user.id,
        usuario_nombre: usuarioNombre,
        email_enviado: false,
      });
      if (histErr) console.error("[candidatos] historial:", histErr.message);
    }

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

    // Desactivar empleado (constraint exige fecha_baja al desactivar)
    await supabase
      .from("empleados")
      .update({
        estado: "Inactivo",
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
