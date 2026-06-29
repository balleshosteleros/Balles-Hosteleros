"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
  return { supabase, userId: user?.id ?? null, empresaId };
}

// ─── ME GUSTA ───────────────────────────────────────────────────
export interface LikeInfo {
  total: number;
  yoLeDi: boolean;
}

export async function getLikeLeccion(leccionId: string): Promise<LikeInfo> {
  const { supabase, userId } = await ctx();
  const { data } = await supabase
    .from("formacion_likes")
    .select("user_id")
    .eq("leccion_id", leccionId);
  const total = data?.length ?? 0;
  const yoLeDi = !!data?.some((r) => r.user_id === userId);
  return { total, yoLeDi };
}

export async function toggleLikeLeccion(
  leccionId: string,
): Promise<{ ok: boolean; info?: LikeInfo; error?: string }> {
  const { supabase, userId, empresaId } = await ctx();
  if (!userId || !empresaId) return { ok: false, error: "No autenticado" };

  const { data: existente } = await supabase
    .from("formacion_likes")
    .select("id")
    .eq("leccion_id", leccionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existente) {
    await supabase.from("formacion_likes").delete().eq("id", existente.id);
  } else {
    await supabase.from("formacion_likes").insert({
      empresa_id: empresaId,
      leccion_id: leccionId,
      user_id: userId,
    });
  }
  return { ok: true, info: await getLikeLeccion(leccionId) };
}

// ─── PREGUNTAS (privadas a RRHH) ─────────────────────────────────
export interface PreguntaFormacion {
  id: string;
  leccionId: string;
  cursoId: string;
  userId: string;
  pregunta: string;
  respuesta: string | null;
  respondidaAt: string | null;
  createdAt: string;
  autorNombre?: string;
}

export async function listPreguntasLeccion(leccionId: string): Promise<PreguntaFormacion[]> {
  const { supabase } = await ctx();
  const { data } = await supabase
    .from("formacion_preguntas")
    .select("id, leccion_id, curso_id, user_id, pregunta, respuesta, respondida_at, created_at")
    .eq("leccion_id", leccionId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    leccionId: r.leccion_id,
    cursoId: r.curso_id,
    userId: r.user_id,
    pregunta: r.pregunta,
    respuesta: r.respuesta,
    respondidaAt: r.respondida_at,
    createdAt: r.created_at,
  }));
}

export async function enviarPregunta(
  cursoId: string,
  leccionId: string,
  pregunta: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, userId, empresaId } = await ctx();
  if (!userId || !empresaId) return { ok: false, error: "No autenticado" };
  const texto = pregunta.trim();
  if (!texto) return { ok: false, error: "Escribe una pregunta" };

  const { error } = await supabase.from("formacion_preguntas").insert({
    empresa_id: empresaId,
    curso_id: cursoId,
    leccion_id: leccionId,
    user_id: userId,
    pregunta: texto,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function responderPregunta(
  preguntaId: string,
  respuesta: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "No autenticado" };
  const { error } = await supabase
    .from("formacion_preguntas")
    .update({
      respuesta: respuesta.trim(),
      respondida_por: userId,
      respondida_at: new Date().toISOString(),
    })
    .eq("id", preguntaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── CUESTIONARIO (tipo test) ────────────────────────────────────
export interface OpcionCuestionario {
  texto: string;
  correcta: boolean;
}
export interface PreguntaCuestionario {
  id: string;
  leccionId: string;
  enunciado: string;
  opciones: OpcionCuestionario[];
  orden: number;
}

export async function listCuestionario(leccionId: string): Promise<PreguntaCuestionario[]> {
  const { supabase } = await ctx();
  const { data } = await supabase
    .from("formacion_cuestionario_preguntas")
    .select("id, leccion_id, enunciado, opciones, orden")
    .eq("leccion_id", leccionId)
    .order("orden", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    leccionId: r.leccion_id,
    enunciado: r.enunciado,
    opciones: (r.opciones as OpcionCuestionario[]) ?? [],
    orden: r.orden ?? 0,
  }));
}

export async function guardarPreguntaCuestionario(
  leccionId: string,
  enunciado: string,
  opciones: OpcionCuestionario[],
  preguntaId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "No autenticado" };
  if (preguntaId) {
    const { error } = await supabase
      .from("formacion_cuestionario_preguntas")
      .update({ enunciado, opciones })
      .eq("id", preguntaId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("formacion_cuestionario_preguntas").insert({
      empresa_id: empresaId,
      leccion_id: leccionId,
      enunciado,
      opciones,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function borrarPreguntaCuestionario(
  preguntaId: string,
): Promise<{ ok: boolean }> {
  const { supabase } = await ctx();
  await supabase.from("formacion_cuestionario_preguntas").delete().eq("id", preguntaId);
  return { ok: true };
}

// El empleado envía sus respuestas; corregimos en servidor y guardamos el intento.
export async function enviarIntentoCuestionario(
  leccionId: string,
  respuestas: Record<string, number>, // preguntaId → índice de opción elegida
  aprobadoPct: number,
): Promise<{ ok: boolean; notaPct: number; aprobado: boolean; error?: string }> {
  const { supabase, userId, empresaId } = await ctx();
  if (!userId || !empresaId) return { ok: false, notaPct: 0, aprobado: false, error: "No autenticado" };

  const preguntas = await listCuestionario(leccionId);
  if (preguntas.length === 0) return { ok: false, notaPct: 0, aprobado: false, error: "Sin preguntas" };

  let aciertos = 0;
  for (const p of preguntas) {
    const elegida = respuestas[p.id];
    if (elegida != null && p.opciones[elegida]?.correcta) aciertos++;
  }
  const notaPct = Math.round((aciertos / preguntas.length) * 100);
  const aprobado = notaPct >= aprobadoPct;

  await supabase.from("formacion_cuestionario_intentos").insert({
    empresa_id: empresaId,
    leccion_id: leccionId,
    user_id: userId,
    nota_pct: notaPct,
    aprobado,
    respuestas,
  });

  return { ok: true, notaPct, aprobado };
}
