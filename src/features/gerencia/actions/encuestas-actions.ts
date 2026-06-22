"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type {
  Encuesta,
  EstadoEncuesta,
  GrupoPreguntas,
  RespuestaEmpleado,
} from "@/features/rrhh/data/encuestas";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/** Config rica que viaja en la columna jsonb `config`. */
interface EncuestaConfig {
  creadorId: string;
  creadorNombre: string;
  fechaCreacion: string;
  anonima: boolean;
  unaRespuesta: boolean;
  modificarRespuesta: boolean;
  mensajeInicial: string;
  mensajeFinal: string;
  destinatarios: Encuesta["destinatarios"];
  grupos: GrupoPreguntas[];
}

type EncuestaRow = {
  id: string;
  empresa_id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  config: EncuestaConfig | null;
  respuestas_count: number | null;
  created_at: string;
};

/** Fila de BD → modelo rico `Encuesta` (las respuestas se inyectan aparte). */
function rowToEncuesta(row: EncuestaRow, respuestas: RespuestaEmpleado[]): Encuesta {
  const c = row.config ?? ({} as Partial<EncuestaConfig>);
  return {
    id: row.id,
    empresaId: row.empresa_id,
    nombre: row.titulo ?? "",
    descripcion: row.descripcion ?? "",
    estado: (row.estado as EstadoEncuesta) ?? "borrador",
    creadorId: c.creadorId ?? "",
    creadorNombre: c.creadorNombre ?? "",
    fechaCreacion: c.fechaCreacion ?? (row.created_at ?? "").slice(0, 10),
    fechaCierre: row.fecha_fin ?? "",
    anonima: c.anonima ?? false,
    unaRespuesta: c.unaRespuesta ?? true,
    modificarRespuesta: c.modificarRespuesta ?? false,
    mensajeInicial: c.mensajeInicial ?? "",
    mensajeFinal: c.mensajeFinal ?? "",
    destinatarios: c.destinatarios ?? { tipo: "todos", ids: [] },
    grupos: c.grupos ?? [],
    respuestas,
  };
}

/** Modelo rico `Encuesta` → columnas + config jsonb para persistir. */
function encuestaToRow(enc: Encuesta, empresaId: string) {
  const config: EncuestaConfig = {
    creadorId: enc.creadorId,
    creadorNombre: enc.creadorNombre,
    fechaCreacion: enc.fechaCreacion,
    anonima: enc.anonima,
    unaRespuesta: enc.unaRespuesta,
    modificarRespuesta: enc.modificarRespuesta,
    mensajeInicial: enc.mensajeInicial,
    mensajeFinal: enc.mensajeFinal,
    destinatarios: enc.destinatarios,
    grupos: enc.grupos,
  };
  return {
    empresa_id: empresaId,
    titulo: enc.nombre || "Encuesta sin título",
    descripcion: enc.descripcion || null,
    estado: enc.estado,
    fecha_inicio: enc.fechaCreacion || null,
    fecha_fin: enc.fechaCierre || null,
    preguntas: enc.grupos.flatMap((g) => g.preguntas), // espejo plano (compat/listados)
    config,
  };
}

/** Carga las respuestas de un conjunto de encuestas agrupadas por encuesta_id. */
async function cargarRespuestas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  encuestaIds: string[],
): Promise<Map<string, RespuestaEmpleado[]>> {
  const mapa = new Map<string, RespuestaEmpleado[]>();
  if (encuestaIds.length === 0) return mapa;
  const { data } = await supabase
    .from("encuesta_respuestas")
    .select("encuesta_id, empleado_id, anonima, respuestas, created_at")
    .in("encuesta_id", encuestaIds);
  for (const r of data ?? []) {
    const row = r as {
      encuesta_id: string;
      empleado_id: string | null;
      anonima: boolean;
      respuestas: Record<string, string | string[] | number>;
      created_at: string;
    };
    const lista = mapa.get(row.encuesta_id) ?? [];
    lista.push({
      empleadoId: row.anonima ? "" : row.empleado_id ?? "",
      fecha: (row.created_at ?? "").slice(0, 10),
      respuestas: row.respuestas ?? {},
    });
    mapa.set(row.encuesta_id, lista);
  }
  return mapa;
}

/** Todas las encuestas de la empresa activa (modelo rico, con respuestas). */
export async function listEncuestas(): Promise<{ ok: boolean; data: Encuesta[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("encuestas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as EncuestaRow[];
    const respuestasPorEnc = await cargarRespuestas(
      supabase,
      rows.map((r) => r.id),
    );
    return {
      ok: true,
      data: rows.map((r) => rowToEncuesta(r, respuestasPorEnc.get(r.id) ?? [])),
    };
  } catch (err) {
    console.error("[encuestas] listEncuestas:", err);
    return { ok: false, data: [] };
  }
}

/** Crea una encuesta a partir del modelo rico y devuelve la versión persistida. */
export async function createEncuesta(
  enc: Encuesta,
): Promise<{ ok: boolean; data?: Encuesta; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data, error } = await supabase
      .from("encuestas")
      .insert({ ...encuestaToRow(enc, empresaId), created_by: user?.id ?? null })
      .select("*")
      .single();
    if (error) throw error;
    const persisted = rowToEncuesta(data as EncuestaRow, []);
    // Encuesta creada ya activa → notificar a su audiencia (motor de alertas PRP-065).
    if (persisted.estado === "activa") {
      const { emitirNotifEncuesta } = await import(
        "@/features/notificaciones/actions/emisores-actions"
      );
      await emitirNotifEncuesta({
        encuestaId: persisted.id,
        empresaId,
        nombre: persisted.nombre,
        descripcion: persisted.descripcion,
        destinatarios: persisted.destinatarios,
      });
    }
    return { ok: true, data: persisted };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[encuestas] createEncuesta:", msg);
    return { ok: false, error: msg };
  }
}

/** Guarda (actualiza) el modelo rico completo de una encuesta existente. */
export async function saveEncuesta(
  enc: Encuesta,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { data: anterior } = await supabase
      .from("encuestas")
      .select("estado")
      .eq("id", enc.id)
      .maybeSingle();
    const { error } = await supabase
      .from("encuestas")
      .update({ ...encuestaToRow(enc, empresaId), updated_at: new Date().toISOString() })
      .eq("id", enc.id);
    if (error) throw error;
    // Transición borrador → activa: notificar a la audiencia una sola vez
    // (motor de alertas PRP-065, idempotente por encuesta).
    if (anterior?.estado !== "activa" && enc.estado === "activa") {
      const { emitirNotifEncuesta } = await import(
        "@/features/notificaciones/actions/emisores-actions"
      );
      await emitirNotifEncuesta({
        encuestaId: enc.id,
        empresaId,
        nombre: enc.nombre,
        descripcion: enc.descripcion,
        destinatarios: enc.destinatarios,
      });
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[encuestas] saveEncuesta:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEncuesta(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("encuestas").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[encuestas] deleteEncuesta:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Lado empleado ──────────────────────────────────────────────

/**
 * Encuestas activas visibles para el empleado autenticado, con su propia
 * respuesta (si ya respondió) para resolver "una respuesta"/modificación.
 */
export async function listEncuestasActivasEmpleado(): Promise<{
  ok: boolean;
  data: Encuesta[];
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("encuestas")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("estado", "activa")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as EncuestaRow[];

    // Solo las respuestas del propio usuario (las demás no le incumben).
    const { data: mias } = await supabase
      .from("encuesta_respuestas")
      .select("encuesta_id, empleado_id, anonima, respuestas, created_at")
      .in("encuesta_id", rows.map((r) => r.id))
      .eq("user_id", user.id);
    const mapa = new Map<string, RespuestaEmpleado[]>();
    for (const r of mias ?? []) {
      const row = r as {
        encuesta_id: string;
        empleado_id: string | null;
        anonima: boolean;
        respuestas: Record<string, string | string[] | number>;
        created_at: string;
      };
      mapa.set(row.encuesta_id, [
        {
          empleadoId: row.empleado_id ?? user.id,
          fecha: (row.created_at ?? "").slice(0, 10),
          respuestas: row.respuestas ?? {},
        },
      ]);
    }
    return { ok: true, data: rows.map((r) => rowToEncuesta(r, mapa.get(r.id) ?? [])) };
  } catch (err) {
    console.error("[encuestas] listEncuestasActivasEmpleado:", err);
    return { ok: false, data: [] };
  }
}

/** Registra (o actualiza, si se permite) la respuesta del empleado. */
export async function submitRespuestaEncuesta(
  encuestaId: string,
  respuestas: Record<string, string | string[] | number>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const { data: enc, error: encErr } = await supabase
      .from("encuestas")
      .select("config, estado")
      .eq("id", encuestaId)
      .single();
    if (encErr) throw encErr;
    if ((enc as { estado: string }).estado !== "activa") {
      return { ok: false, error: "La encuesta no está activa" };
    }
    const config = ((enc as { config: EncuestaConfig | null }).config ?? {}) as Partial<EncuestaConfig>;
    const anonima = config.anonima ?? false;

    const { data: empleado } = await supabase
      .from("empleados")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const empleadoId = (empleado?.id as string | undefined) ?? null;

    // ¿Ya respondió este usuario?
    const { data: previa } = await supabase
      .from("encuesta_respuestas")
      .select("id")
      .eq("encuesta_id", encuestaId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (previa?.id) {
      if (!(config.modificarRespuesta ?? false)) {
        return { ok: false, error: "Ya has respondido esta encuesta" };
      }
      const { error } = await supabase
        .from("encuesta_respuestas")
        .update({ respuestas, anonima, empleado_id: anonima ? null : empleadoId })
        .eq("id", previa.id);
      if (error) throw error;
      return { ok: true };
    }

    const { error } = await supabase.from("encuesta_respuestas").insert({
      encuesta_id: encuestaId,
      empresa_id: empresaId,
      user_id: user.id,
      empleado_id: anonima ? null : empleadoId,
      anonima,
      respuestas,
    });
    if (error) throw error;

    // Contador de respuestas (best-effort).
    const { count } = await supabase
      .from("encuesta_respuestas")
      .select("id", { count: "exact", head: true })
      .eq("encuesta_id", encuestaId);
    if (typeof count === "number") {
      await supabase.from("encuestas").update({ respuestas_count: count }).eq("id", encuestaId);
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[encuestas] submitRespuestaEncuesta:", msg);
    return { ok: false, error: msg };
  }
}
