"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  getFasePrincipal,
  type EstadoReclutamiento,
  type FasePrincipal,
  type HistorialCambioFase,
  type NotaCandidato,
  type ResenaCandidato,
  type ResenaCriterio,
} from "@/features/rrhh/data/reclutamiento";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/** Nombre legible del usuario actual (nombre+apellidos → full_name → email). */
async function nombreUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, apellidos, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "Usuario";
  const nombreCompleto = [data.nombre, data.apellidos].filter(Boolean).join(" ").trim();
  return (
    nombreCompleto ||
    (data.full_name as string | null) ||
    (data.email as string | null) ||
    "Usuario"
  );
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Actividad (historial de cambios de estado) ──────────────────────────────
export async function getActividadCandidato(
  candidatoId: string,
): Promise<HistorialCambioFase[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("candidato_historial")
    .select("id, fase_anterior, estado_anterior, fase_nueva, estado_nuevo, usuario_nombre, email_enviado, email_asunto, vacante_anterior_nombre, vacante_nueva_nombre, created_at")
    .eq("candidato_id", candidatoId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[candidato-ficha] getActividad:", error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const estadoNuevo = (r.estado_nuevo as EstadoReclutamiento) ?? "nuevo";
    const estadoAnterior = (r.estado_anterior as EstadoReclutamiento) ?? estadoNuevo;
    const faseNueva = (r.fase_nueva as FasePrincipal) ?? getFasePrincipal(estadoNuevo);
    const faseAnterior =
      (r.fase_anterior as FasePrincipal) ?? getFasePrincipal(estadoAnterior);
    return {
      id: r.id as string,
      faseAnterior,
      estadoAnterior,
      faseNueva,
      estadoNuevo,
      usuario: (r.usuario_nombre as string | null) ?? "Sistema",
      fecha: fmtFecha(r.created_at as string),
      emailEnviado: !!r.email_enviado,
      emailAsunto: (r.email_asunto as string | null) ?? null,
      vacanteAnterior: (r.vacante_anterior_nombre as string | null) ?? null,
      vacanteNueva: (r.vacante_nueva_nombre as string | null) ?? null,
    };
  });
}

// ─── Notas ───────────────────────────────────────────────────────────────────
export async function listNotasCandidato(candidatoId: string): Promise<NotaCandidato[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("candidato_notas")
    .select("id, autor_nombre, texto, created_at")
    .eq("candidato_id", candidatoId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[candidato-ficha] listNotas:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    autor: (r.autor_nombre as string | null) ?? "Usuario",
    fecha: fmtFecha(r.created_at as string),
    texto: r.texto as string,
  }));
}

export async function addNotaCandidato(
  candidatoId: string,
  texto: string,
): Promise<{ ok: true; nota: NotaCandidato } | { ok: false; error: string }> {
  const trimmed = texto.trim();
  if (!trimmed) return { ok: false, error: "La nota no puede estar vacía" };
  const { supabase, user, empresaId } = await ctx();
  if (!empresaId || !user) return { ok: false, error: "Sin empresa activa" };

  const autor = await nombreUsuario(supabase, user.id);
  const { data, error } = await supabase
    .from("candidato_notas")
    .insert({
      empresa_id: empresaId,
      candidato_id: candidatoId,
      autor_id: user.id,
      autor_nombre: autor,
      texto: trimmed,
    })
    .select("id, created_at")
    .single();
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    nota: {
      id: data.id as string,
      autor,
      fecha: fmtFecha(data.created_at as string),
      texto: trimmed,
    },
  };
}

// ─── Reseñas ─────────────────────────────────────────────────────────────────
export async function listResenasCandidato(
  candidatoId: string,
): Promise<ResenaCandidato[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("candidato_resenas")
    .select("id, autor_nombre, puntuaciones, comentario, created_at")
    .eq("candidato_id", candidatoId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[candidato-ficha] listResenas:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    autor: (r.autor_nombre as string | null) ?? "Usuario",
    fecha: fmtFecha(r.created_at as string),
    puntuaciones: ((r.puntuaciones ?? []) as ResenaCriterio[]).filter(
      (p) => typeof p?.criterioId === "string" && typeof p?.estrellas === "number",
    ),
    comentario: (r.comentario as string | null) ?? undefined,
  }));
}

export async function addResenaCandidato(
  candidatoId: string,
  input: { puntuaciones: ResenaCriterio[]; comentario?: string },
): Promise<{ ok: true; resena: ResenaCandidato } | { ok: false; error: string }> {
  const puntuaciones = (input.puntuaciones ?? [])
    .filter((p) => p.estrellas > 0)
    .map((p) => ({ criterioId: p.criterioId, estrellas: Math.min(5, Math.max(1, p.estrellas)) }));
  const comentario = input.comentario?.trim() || undefined;
  if (puntuaciones.length === 0 && !comentario) {
    return { ok: false, error: "Puntúa al menos un criterio o escribe un comentario" };
  }
  const { supabase, user, empresaId } = await ctx();
  if (!empresaId || !user) return { ok: false, error: "Sin empresa activa" };

  const autor = await nombreUsuario(supabase, user.id);
  const { data, error } = await supabase
    .from("candidato_resenas")
    .insert({
      empresa_id: empresaId,
      candidato_id: candidatoId,
      autor_id: user.id,
      autor_nombre: autor,
      puntuaciones,
      comentario: comentario ?? null,
    })
    .select("id, created_at")
    .single();
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    resena: {
      id: data.id as string,
      autor,
      fecha: fmtFecha(data.created_at as string),
      puntuaciones,
      comentario,
    },
  };
}

export async function deleteResenaCandidato(
  resenaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };
  const { error } = await supabase
    .from("candidato_resenas")
    .delete()
    .eq("id", resenaId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
