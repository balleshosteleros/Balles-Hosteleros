"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  MAX_PREGUNTAS_CUESTIONARIO,
  MAX_OPCIONES_PREGUNTA,
  type CuestionarioVacante,
  type PreguntaCuestionario,
} from "@/features/rrhh/data/cuestionario-vacante";

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

interface CuestionarioRow {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  preguntas: PreguntaCuestionario[];
  es_default: boolean;
  activa: boolean;
}

function rowToCuestionario(r: CuestionarioRow, usado: boolean): CuestionarioVacante {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    preguntas: Array.isArray(r.preguntas) ? r.preguntas : [],
    esDefault: r.es_default,
    activa: r.activa,
    usado,
  };
}

/** Normaliza: todas las preguntas son obligatorias (la nota es sobre el total). */
function normalizarPreguntas(preguntas: PreguntaCuestionario[]): PreguntaCuestionario[] {
  return preguntas.map((p) => ({ ...p, obligatoria: true }));
}

/** Valida las preguntas. Devuelve mensaje de error o null si todo correcto. */
function validarPreguntas(preguntas: PreguntaCuestionario[]): string | null {
  if (preguntas.length === 0) return "Añade al menos una pregunta";
  if (preguntas.length > MAX_PREGUNTAS_CUESTIONARIO) {
    return `Máximo ${MAX_PREGUNTAS_CUESTIONARIO} preguntas por cuestionario`;
  }
  for (let i = 0; i < preguntas.length; i++) {
    const p = preguntas[i];
    if (!p.titulo?.trim()) return `La pregunta ${i + 1} no tiene título`;
    const opciones = (p.opciones ?? []).filter((o) => o.texto?.trim());
    if (opciones.length < 2) return `La pregunta ${i + 1} necesita al menos 2 opciones`;
    if (opciones.length > MAX_OPCIONES_PREGUNTA) {
      return `La pregunta ${i + 1} no puede tener más de ${MAX_OPCIONES_PREGUNTA} respuestas`;
    }
    if (!opciones.some((o) => o.correcta)) {
      return `Marca la respuesta correcta en la pregunta ${i + 1}`;
    }
  }
  return null;
}

export async function listCuestionariosVacante() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as CuestionarioVacante[] };

    const { data, error } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .select("id, empresa_id, nombre, descripcion, preguntas, es_default, activa")
      .eq("empresa_id", empresaId)
      .order("es_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;

    // Marca qué cuestionarios ya han sido usados por algún candidato (no editables).
    const { data: usados } = await supabase
      .from("candidato_cuestionario_respuestas")
      .select("cuestionario_plantilla_id")
      .eq("empresa_id", empresaId)
      .not("cuestionario_plantilla_id", "is", null);
    const usadosSet = new Set(
      (usados ?? []).map((u) => u.cuestionario_plantilla_id as string),
    );

    const rows = (data ?? []) as unknown as CuestionarioRow[];
    return {
      ok: true,
      data: rows.map((r) => rowToCuestionario(r, usadosSet.has(r.id))),
    };
  } catch (err) {
    console.error("[rrhh] listCuestionariosVacante:", err);
    return { ok: false, data: [] as CuestionarioVacante[] };
  }
}

export async function getCuestionarioVacante(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: null };
    const { data, error } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .select("id, empresa_id, nombre, descripcion, preguntas, es_default, activa")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, data: null };

    const { count } = await supabase
      .from("candidato_cuestionario_respuestas")
      .select("id", { count: "exact", head: true })
      .eq("cuestionario_plantilla_id", id);
    return { ok: true, data: rowToCuestionario(data as unknown as CuestionarioRow, (count ?? 0) > 0) };
  } catch (err) {
    console.error("[rrhh] getCuestionarioVacante:", err);
    return { ok: false, data: null };
  }
}

export async function createCuestionarioVacante(input: {
  nombre: string;
  descripcion?: string | null;
  preguntas: PreguntaCuestionario[];
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre?.trim()) return { ok: false, error: "El nombre es obligatorio" };
    const preguntas = normalizarPreguntas(input.preguntas);
    const errPreg = validarPreguntas(preguntas);
    if (errPreg) return { ok: false, error: errPreg };

    const { data, error } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .insert({
        empresa_id: empresaId,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion ?? null,
        preguntas,
        es_default: false,
        activa: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, id: data.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createCuestionarioVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateCuestionarioVacante(
  id: string,
  input: { nombre: string; descripcion?: string | null; preguntas: PreguntaCuestionario[] },
) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre?.trim()) return { ok: false, error: "El nombre es obligatorio" };
    const preguntas = normalizarPreguntas(input.preguntas);
    const errPreg = validarPreguntas(preguntas);
    if (errPreg) return { ok: false, error: errPreg };

    // Bloqueo: si ya lo usó algún candidato, no se puede editar (rompería las
    // notas históricas). Hay que duplicarlo.
    const { count } = await supabase
      .from("candidato_cuestionario_respuestas")
      .select("id", { count: "exact", head: true })
      .eq("cuestionario_plantilla_id", id);
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: "Este cuestionario ya lo han respondido candidatos. Duplícalo para crear una versión nueva.",
      };
    }

    const { error } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .update({
        nombre: input.nombre.trim(),
        descripcion: input.descripcion ?? null,
        preguntas,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateCuestionarioVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function duplicarCuestionarioVacante(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data: orig, error } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .select("nombre, descripcion, preguntas")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();
    if (error) throw error;

    const { data: copia, error: insErr } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .insert({
        empresa_id: empresaId,
        nombre: `${orig.nombre} (copia)`,
        descripcion: orig.descripcion,
        preguntas: orig.preguntas,
        es_default: false,
        activa: true,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, id: copia.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] duplicarCuestionarioVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteCuestionarioVacante(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: c } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .select("es_default")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (c?.es_default) {
      return { ok: false, error: "No se puede eliminar el cuestionario por defecto." };
    }

    // Bloqueo: si ya lo respondió algún candidato, NO se puede borrar (el
    // candidato conserva el cuestionario que rellenó en su momento). Hay que
    // crear/duplicar uno nuevo y editarlo en las vacantes.
    const { count } = await supabase
      .from("candidato_cuestionario_respuestas")
      .select("id", { count: "exact", head: true })
      .eq("cuestionario_plantilla_id", id);
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "No se puede eliminar: candidatos ya han respondido este cuestionario. Sus respuestas quedan guardadas tal cual. Duplícalo para crear una versión nueva y asígnala en las vacantes.",
      };
    }

    // Desvincular de las vacantes que lo usen (volverán a 'sin cuestionario').
    await supabase
      .from("vacantes")
      .update({ cuestionario_plantilla_id: null, cuestionario: false })
      .eq("cuestionario_plantilla_id", id)
      .eq("empresa_id", empresaId);

    const { error } = await supabase
      .from("reclutamiento_plantillas_cuestionario")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deleteCuestionarioVacante:", msg);
    return { ok: false, error: msg };
  }
}

export interface RespuestaCuestionarioCandidato {
  id: string;
  cuestionarioNombre: string | null;
  preguntas: PreguntaCuestionario[];
  respuestas: Record<string, string>;
  aciertos: number;
  totalPreguntas: number;
  nota: number;
  respondidoAt: string;
}

/** Respuesta + nota del candidato para mostrar en su ficha. */
export async function getRespuestaCuestionarioCandidato(
  candidatoId: string,
): Promise<{ ok: boolean; data: RespuestaCuestionarioCandidato | null }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: null };
    const { data, error } = await supabase
      .from("candidato_cuestionario_respuestas")
      .select("id, cuestionario_nombre, preguntas_snapshot, respuestas, aciertos, total_preguntas, nota, respondido_at")
      .eq("candidato_id", candidatoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id: data.id as string,
        cuestionarioNombre: (data.cuestionario_nombre as string | null) ?? null,
        preguntas: (Array.isArray(data.preguntas_snapshot) ? data.preguntas_snapshot : []) as PreguntaCuestionario[],
        respuestas: (data.respuestas ?? {}) as Record<string, string>,
        aciertos: (data.aciertos as number) ?? 0,
        totalPreguntas: (data.total_preguntas as number) ?? 0,
        nota: Number(data.nota ?? 0),
        respondidoAt: data.respondido_at as string,
      },
    };
  } catch (err) {
    console.error("[rrhh] getRespuestaCuestionarioCandidato:", err);
    return { ok: false, data: null };
  }
}
