"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  normalizarNombre,
  normalizarNombreOrNull,
} from "@/shared/lib/normalizar-nombre";
import type { FasePrincipal } from "@/features/rrhh/data/reclutamiento";

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
  let raw = "";
  if (err instanceof Error) raw = err.message;
  else if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") raw = m;
  }
  if (!raw) return "No se pudo completar la acción. Inténtalo de nuevo.";
  // Nunca mostramos errores técnicos de la base de datos (en inglés) al usuario.
  if (/violates check constraint|check constraint/i.test(raw))
    return "No se pudo mover el candidato a esa fase. Avisa a soporte si continúa.";
  if (/violates foreign key|foreign key constraint/i.test(raw))
    return "Falta un dato relacionado para completar la acción.";
  if (/duplicate key|already exists|unique constraint/i.test(raw))
    return "Ya existe un registro con esos datos.";
  if (/permission denied|row-level security|rls/i.test(raw))
    return "No tienes permiso para esta acción.";
  // Si el mensaje ya está en español (nuestro), se muestra tal cual.
  if (/[áéíóúñ¿¡]/i.test(raw) || /^[^\x00-\x7F]*[a-z]/i.test(raw) === false) return raw;
  return "No se pudo completar la acción. Inténtalo de nuevo.";
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

/**
 * Devuelve el enlace personal de documentación del candidato (lo genera de
 * forma perezosa si aún no existe). Lo usa la pestaña «Documentación» de la
 * ficha para mostrar/copiar el enlace y reenviarlo, sin tener que mover de fase.
 */
export async function getEnlaceDocumentacionCandidato(
  candidatoId: string,
): Promise<{ ok: true; enlace: string } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { asegurarTokenDocumentacion, enlaceDocumentacion } = await import(
      "@/features/rrhh/lib/documentacion-candidato"
    );
    const token = await asegurarTokenDocumentacion(supabase, candidatoId, empresaId);
    if (!token) return { ok: false, error: "No se pudo generar el enlace" };
    return { ok: true, enlace: enlaceDocumentacion(token) };
  } catch (err: unknown) {
    return { ok: false, error: mensajeError(err) };
  }
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
        como_nos_conocio,
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
  fase: FasePrincipal,
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
        error: "YA_EMPLEADO",
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

    // PRP-070: al ENTRAR en la fase Prueba, el empleado (creado en Contratación)
    // recibe el email de acceso (elige contraseña), diferido hasta este momento.
    if (estado === "prueba" && cand?.estado !== "prueba" && cand?.empleado_id) {
      try {
        const { enviarAccesoEmpleadoPorId } = await import(
          "@/features/rrhh/actions/contratacion-actions"
        );
        await enviarAccesoEmpleadoPorId(cand.empleado_id as string);
      } catch (e) {
        console.error("[candidatos] acceso al pasar a prueba:", e);
      }
    }

    // Offboarding cerrado: al pasar a EX-EMPLEADO, el empleado queda Inactivo y
    // su usuario pierde el acceso (el trigger empleados_sync_estado_acceso pone
    // usuarios.estado_acceso = 'Inactivo' → login bloqueado). La baja también
    // recorta su horario futuro (setEmpleadoEstado → recortarHorarioFuturoPorBaja).
    // Fecha de baja: la que ya tenga el empleado, o el último día de su solicitud
    // de baja de contrato, o hoy como último recurso.
    if (estado === "ex_empleado" && cand?.estado !== "ex_empleado" && cand?.empleado_id) {
      try {
        const empleadoId = cand.empleado_id as string;
        const { data: emp } = await supabase
          .from("empleados")
          .select("id, user_id, fecha_baja")
          .eq("id", empleadoId)
          .maybeSingle();

        let fechaBaja = (emp?.fecha_baja as string | null) ?? null;
        if (!fechaBaja && emp?.user_id) {
          const { data: sol } = await supabase
            .from("solicitudes_personal")
            .select("fecha_fin")
            .eq("empresa_id", empresaId)
            .eq("user_id", emp.user_id as string)
            .eq("subtipo", "baja_contrato")
            .not("fecha_fin", "is", null)
            .order("fecha_fin", { ascending: false })
            .limit(1)
            .maybeSingle();
          fechaBaja = (sol?.fecha_fin as string | null) ?? null;
        }
        if (!fechaBaja) fechaBaja = ahora.slice(0, 10);

        const { setEmpleadoEstado } = await import(
          "@/features/rrhh/actions/empleados-actions"
        );
        await setEmpleadoEstado({ id: empleadoId, estado: "Inactivo", fechaBaja });
      } catch (e) {
        console.error("[candidatos] baja al pasar a ex_empleado:", e);
      }
    }

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
  fase: FasePrincipal,
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
    como_nos_conocio?: string | null;
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
    if ("como_nos_conocio" in input) patch.como_nos_conocio = input.como_nos_conocio?.trim() || null;
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

