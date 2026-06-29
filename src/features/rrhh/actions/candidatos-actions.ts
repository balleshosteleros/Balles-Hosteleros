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

/**
 * Mensaje legible de un error. Los errores de Supabase (`PostgrestError`) NO
 * son instancias de `Error`, sino objetos `{ message, details, hint, code }`,
 * por lo que `err instanceof Error` los descartaba y se mostraba el genérico
 * "Error desconocido", ocultando la causa real (p.ej. violación de un CHECK).
 */
function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Error desconocido";
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
        genero, ubicacion, disponibilidad, experiencia_previa, carta_presentacion,
        promovido_at, activo, created_at,
        vacantes(id, titulo, departamento_id, puesto_id),
        candidato_resenas(puntuaciones)
      `)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Nota final de las reseñas = media (0–5) de TODAS las estrellas de TODAS
    // las reseñas del candidato. Misma fórmula que la ficha (CandidatoDetailModal).
    const rows = (data ?? []).map((c) => {
      const resenas = (c as { candidato_resenas?: { puntuaciones?: { estrellas?: number }[] }[] }).candidato_resenas ?? [];
      const estrellas = resenas
        .flatMap((r) => r.puntuaciones ?? [])
        .map((p) => p.estrellas ?? 0)
        .filter((n) => n > 0);
      const nota_resenas = estrellas.length
        ? estrellas.reduce((a, b) => a + b, 0) / estrellas.length
        : null;
      const { candidato_resenas: _omit, ...resto } = c as Record<string, unknown>;
      void _omit;
      return { ...resto, nota_resenas };
    });
    return { ok: true, data: rows };
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
    const msg = mensajeError(err);
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

    // Cada cambio de fase/estado reinicia el contador de «días en la fase actual».
    const faseCambia = !!cand && (cand.fase !== fase || cand.estado !== estado);
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("candidatos")
      .update({
        fase,
        estado,
        updated_at: ahora,
        ...(faseCambia ? { fase_actualizada_at: ahora } : {}),
      })
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
    const msg = mensajeError(err);
    return { ok: false, error: msg };
  }
}

/**
 * Mueve un candidato a OTRA vacante (corrección cuando se inscribió en la
 * vacante equivocada). Permite indicar también la fase/estado de destino dentro
 * de esa vacante. Registra la actividad. No permite mover candidatos ya
 * promovidos a empleado.
 */
export async function moverCandidatoAVacante(
  id: string,
  vacanteId: string,
  fase:
    | "seleccion"
    | "formacion"
    | "descartado"
    | "nuevo"
    | "en_progreso"
    | "oferta"
    | "seleccionado",
  estado: string,
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at, vacante_id, fase, estado")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (cand?.promovido_at) {
      return { ok: false, error: "Este candidato ya es empleado; no se puede cambiar de vacante." };
    }

    // Verifica que la vacante destino pertenece a la empresa.
    const { data: vac } = await supabase
      .from("vacantes")
      .select("id, titulo")
      .eq("id", vacanteId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!vac) return { ok: false, error: "La vacante de destino no existe" };

    // Título de la vacante de origen (para mostrar el movimiento en la actividad).
    let vacanteAnteriorNombre: string | null = null;
    if (cand?.vacante_id) {
      const { data: vacOrigen } = await supabase
        .from("vacantes")
        .select("titulo")
        .eq("id", cand.vacante_id)
        .maybeSingle();
      vacanteAnteriorNombre = (vacOrigen?.titulo as string | null) ?? null;
    }

    // Mover de vacante reinicia siempre el contador de «días en la fase actual».
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("candidatos")
      .update({
        vacante_id: vacanteId,
        fase,
        estado,
        updated_at: ahora,
        fase_actualizada_at: ahora,
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    // Registra el MOVIMIENTO DE VACANTE como evento propio de la actividad: se
    // guardan los títulos de origen y destino. La fase/estado se conservan como
    // contexto, pero la presencia de vacante_nueva_nombre marca la fila como un
    // movimiento de vacante (no un cambio de fase) al renderizar la pestaña.
    if (user && cand) {
      const usuarioNombre = await nombreUsuarioActual(supabase, user.id);
      const { error: histErr } = await supabase.from("candidato_historial").insert({
        empresa_id: empresaId,
        candidato_id: id,
        fase_anterior: cand.fase ?? null,
        estado_anterior: cand.estado ?? null,
        fase_nueva: fase,
        estado_nuevo: estado,
        vacante_anterior_nombre: vacanteAnteriorNombre,
        vacante_nueva_nombre: (vac.titulo as string | null) ?? null,
        usuario_id: user.id,
        usuario_nombre: usuarioNombre,
        email_enviado: false,
      });
      if (histErr) console.error("[candidatos] historial vacante:", histErr.message);
    }

    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

/**
 * Activa/desactiva un candidato. Inactivo = se conserva todo en BD y sigue en el
 * listado de Candidatos, pero desaparece del pipeline (kanban) de su vacante.
 */
export async function setCandidatoActivo(id: string, activo: boolean) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("candidatos")
      .update({ activo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

/**
 * Marca/desmarca al candidato como «visto» (revisado). visto = true sella la
 * fecha de revisión (`visto_at`); visto = false la borra (vuelve a pendiente).
 * Se llama automáticamente al abrir la ficha y, manualmente, desde el botón
 * «Candidato visto» del pie del modal. Idempotente: si ya estaba visto, no
 * reescribe la fecha (conserva la primera revisión).
 */
export async function setCandidatoVisto(id: string, visto: boolean) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    if (visto) {
      // Solo sella la fecha si aún no estaba visto (no pisar la primera revisión).
      const { data: cand } = await supabase
        .from("candidatos")
        .select("visto_at")
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (cand?.visto_at) return { ok: true, vistoAt: cand.visto_at as string };
      const ahora = new Date().toISOString();
      const { error } = await supabase
        .from("candidatos")
        .update({ visto_at: ahora, updated_at: ahora })
        .eq("id", id)
        .eq("empresa_id", empresaId);
      if (error) throw error;
      return { ok: true, vistoAt: ahora };
    }

    const { error } = await supabase
      .from("candidatos")
      .update({ visto_at: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true, vistoAt: null };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

/**
 * Persiste los datos editables de la ficha del candidato (género, ubicación y
 * disponibilidad de incorporación). Solo actualiza los campos presentes en
 * `input`. Best-effort sobre la empresa activa.
 */
export async function actualizarDatosCandidato(
  id: string,
  input: {
    genero?: "masculino" | "femenino" | null;
    ubicacion?: string | null;
    disponibilidad?: "inmediato" | "15_dias" | null;
    experiencia_previa?: "sin_experiencia" | "menos_1" | "de_1_a_5" | "mas_5" | null;
    carta_presentacion?: string | null;
  },
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("genero" in input) patch.genero = input.genero || null;
    if ("ubicacion" in input) patch.ubicacion = input.ubicacion?.trim() || null;
    if ("disponibilidad" in input) patch.disponibilidad = input.disponibilidad || null;
    if ("experiencia_previa" in input) patch.experiencia_previa = input.experiencia_previa || null;
    if ("carta_presentacion" in input) patch.carta_presentacion = input.carta_presentacion?.trim() || null;

    const { error } = await supabase
      .from("candidatos")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
}

export async function eliminarCandidato(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Un candidato ya contratado (promovido a empleado) NO puede borrarse: su
    // candidatura debe perdurar en la base de datos como historial.
    const { data: cand } = await supabase
      .from("candidatos")
      .select("promovido_at")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();
    if (cand?.promovido_at) {
      return { ok: false, error: "Este candidato ya es empleado; su candidatura no se puede borrar." };
    }

    const { error } = await supabase
      .from("candidatos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = mensajeError(err);
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
    const msg = mensajeError(err);
    return { ok: false, error: msg };
  }
}
