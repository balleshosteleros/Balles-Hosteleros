"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppContext } from "@/lib/supabase/get-context";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

// Emisores por evento (PRP-065 Fase 3). Cada uno se dispara desde la acción de
// origen tras una publicación, va detrás del toggle de empresa y emite en el
// espacio de logins (segmento "usuarios") reusando la resolución de audiencia ya
// existente. Todos son tolerantes a fallo: nunca rompen el flujo que los invoca.

async function toggleActivo(
  supabase: SupabaseClient,
  empresaId: string,
  columna: "notif_comunicados_activo" | "notif_encuestas_activo",
): Promise<boolean> {
  const { data } = await supabase.from("empresas").select(columna).eq("id", empresaId).maybeSingle();
  // Por defecto activo: solo se apaga si la columna existe y es false.
  return !data || (data as Record<string, unknown>)[columna] !== false;
}

function recortar(texto: string | null | undefined, max = 140): string {
  const t = (texto ?? "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Comunicado publicado → notificación a su audiencia. Idempotente por comunicado. */
export async function emitirNotifComunicado(comunicadoId: string): Promise<void> {
  try {
    const { resolverDestinatariosUserIds } = await import(
      "@/features/mi-panel/mobile/lib/push-comunicado"
    );
    const { userIds, empresaId, titulo, cuerpo } = await resolverDestinatariosUserIds(comunicadoId);
    if (!empresaId || userIds.length === 0) return;

    const ctx = await getAppContext();
    if (!(await toggleActivo(ctx.supabase, empresaId, "notif_comunicados_activo"))) return;

    await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "comunicado",
      titulo: titulo || "Nuevo comunicado",
      mensaje: recortar(cuerpo),
      segmento: { tipo: "usuarios", usuarioIds: userIds },
      refTabla: "comunicados",
      refId: comunicadoId,
      accionUrl: "/comunicados",
      dedupeKey: `comunicado:${comunicadoId}`,
      // El comunicado ya dispara su propio push (comunicado_nuevo); evitamos duplicarlo.
      push: false,
    });
  } catch (e) {
    console.error("[emisores] emitirNotifComunicado:", e);
  }
}

// ── Encuestas ───────────────────────────────────────────────────────
type EncuestaDestinatarios = { tipo: "todos" | "roles" | "departamentos" | "empleados"; ids: string[] };

async function resolverEncuestaUserIds(
  supabase: SupabaseClient,
  empresaId: string,
  dest: EncuestaDestinatarios,
): Promise<string[]> {
  const ids = new Set<string>();
  const push = (rows: { user_id?: string | null }[] | null) =>
    (rows ?? []).forEach((r) => r.user_id && ids.add(r.user_id as string));

  if (dest.tipo === "todos") {
    const { data } = await supabase.from("usuarios").select("user_id").eq("empresa_id", empresaId);
    push(data);
  } else if (dest.tipo === "departamentos" && dest.ids.length > 0) {
    // Las encuestas guardan nombres de departamento (espejo en usuarios.departamento).
    const { data } = await supabase
      .from("usuarios")
      .select("user_id")
      .eq("empresa_id", empresaId)
      .in("departamento", dest.ids);
    push(data);
  } else if (dest.tipo === "roles" && dest.ids.length > 0) {
    const { data } = await supabase
      .from("usuarios")
      .select("user_id")
      .eq("empresa_id", empresaId)
      .in("rol_label", dest.ids);
    push(data);
  } else if (dest.tipo === "empleados" && dest.ids.length > 0) {
    // ids = empleadoIds (fichas) → mapear a su login.
    const { data } = await supabase.from("empleados").select("user_id").in("id", dest.ids);
    push(data);
  }
  return Array.from(ids);
}

/** Encuesta activada → notificación a su audiencia. Idempotente por encuesta. */
export async function emitirNotifEncuesta(args: {
  encuestaId: string;
  empresaId: string;
  nombre: string;
  descripcion?: string | null;
  destinatarios: EncuestaDestinatarios;
}): Promise<void> {
  try {
    const ctx = await getAppContext();
    const empresaId = args.empresaId || ctx.empresaId;
    if (!empresaId) return;
    if (!(await toggleActivo(ctx.supabase, empresaId, "notif_encuestas_activo"))) return;

    const userIds = await resolverEncuestaUserIds(ctx.supabase, empresaId, args.destinatarios);
    if (userIds.length === 0) return;

    await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "encuesta",
      titulo: `Nueva encuesta: ${args.nombre || "sin título"}`,
      mensaje: recortar(args.descripcion),
      segmento: { tipo: "usuarios", usuarioIds: userIds },
      refTabla: "encuestas",
      refId: args.encuestaId,
      accionUrl: "/rrhh/encuestas",
      dedupeKey: `encuesta:${args.encuestaId}`,
    });
  } catch (e) {
    console.error("[emisores] emitirNotifEncuesta:", e);
  }
}
