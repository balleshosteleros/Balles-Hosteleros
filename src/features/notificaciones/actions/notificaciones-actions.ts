"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppContext } from "@/lib/supabase/get-context";
import { resolverDestinatarios } from "@/features/notificaciones/lib/targeting";
import { getTipoMeta } from "@/features/notificaciones/lib/catalogo";
import type { EmitirInput, EmitirResultado } from "@/features/notificaciones/types";

export interface NotificacionApp {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  payload: Record<string, unknown>;
  accionLabel: string;
  requiereAccion: boolean;
  vistaAt: string | null;
  accionadaAt: string | null;
  createdAt: string;
  refTabla: string | null;
  refId: string | null;
}

interface NotifDbRow {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  payload: Record<string, unknown> | null;
  accion_label: string | null;
  requiere_accion: boolean | null;
  vista_at: string | null;
  accionada_at: string | null;
  created_at: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
}

const APP_COLS =
  "id, tipo, titulo, mensaje, payload, accion_label, requiere_accion, vista_at, accionada_at, created_at, entidad_tipo, entidad_id";

function dbToApp(r: NotifDbRow): NotificacionApp {
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    mensaje: r.mensaje,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    accionLabel: r.accion_label ?? "Visto",
    requiereAccion: Boolean(r.requiere_accion),
    vistaAt: r.vista_at,
    accionadaAt: r.accionada_at,
    createdAt: r.created_at,
    refTabla: r.entidad_tipo,
    refId: r.entidad_id,
  };
}

async function misFichas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase.from("empleados").select("id").eq("user_id", userId);
  return (data ?? []).map((f) => f.id as string);
}

// Bandeja del empleado: SUS notificaciones (por usuario o por ficha).
export async function listMisNotificaciones(): Promise<NotificacionApp[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const fichas = await misFichas(supabase, user.id);
    const filtro =
      fichas.length > 0
        ? `usuario_id.eq.${user.id},empleado_id.in.(${fichas.join(",")})`
        : `usuario_id.eq.${user.id}`;
    const { data, error } = await supabase
      .from("notificaciones")
      .select(APP_COLS)
      .or(filtro)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((r) => dbToApp(r as NotifDbRow));
  } catch (err) {
    console.error("[notificaciones] listMisNotificaciones:", err);
    return [];
  }
}

// Pendientes de acuse (sin ver): para el círculo y el auto-pop-up.
export async function listNotificacionesPendientes(): Promise<NotificacionApp[]> {
  const todas = await listMisNotificaciones();
  return todas.filter((n) => !n.vistaAt);
}

// El empleado marca como vista (acuse Visto) o acciona (LIQUIDAR).
export async function marcarNotificacionVista(
  id: string,
  accionar = false,
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = { vista_at: nowIso, leida: true, leida_at: nowIso };
    if (accionar) patch.accionada_at = nowIso;
    const { error } = await supabase
      .from("notificaciones")
      .update(patch)
      .eq("id", id)
      .is("vista_at", null);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[notificaciones] marcarNotificacionVista:", err);
    return { ok: false };
  }
}

// El empleado pulsa LIQUIDAR en una notificación de liquidación: aprueba el pago
// (confirmacion_aceptada_at) y marca la notificación como vista + accionada.
export async function accionarLiquidacion(
  notifId: string,
  pagoId: string,
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };
    const fichas = await misFichas(supabase, user.id);
    if (fichas.length === 0) return { ok: false };

    const nowIso = new Date().toISOString();
    const { error: ePago } = await supabase
      .from("rrhh_pagos")
      .update({ confirmacion_aceptada_at: nowIso })
      .eq("id", pagoId)
      .in("empleado_id", fichas)
      .not("confirmacion_enviada_at", "is", null)
      .is("confirmacion_aceptada_at", null);
    if (ePago) throw ePago;

    const { error: eNotif } = await supabase
      .from("notificaciones")
      .update({ vista_at: nowIso, accionada_at: nowIso, leida: true, leida_at: nowIso })
      .eq("id", notifId);
    if (eNotif) throw eNotif;
    return { ok: true };
  } catch (err) {
    console.error("[notificaciones] accionarLiquidacion:", err);
    return { ok: false };
  }
}

// Cierre por entidad (sistema): marca como vistas/leídas todas las notificaciones
// que apuntan a una entidad concreta (entidad_tipo + entidad_id). Pensado para
// flujos sin sesión del empleado (p. ej. firma de documento por enlace público):
// cuando el trabajador firma, su aviso de "documento para firmar" aparece ya leído
// en el portal. Usa service role porque corre fuera de la sesión del empleado.
export async function marcarNotificacionesVistasPorRef(
  refTabla: string,
  refId: string,
  opts: { accionar?: boolean } = {},
): Promise<{ ok: boolean; cerradas: number }> {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = { vista_at: nowIso, leida: true, leida_at: nowIso };
    // Cuando el cierre equivale a una aprobación (p. ej. la liquidación
    // confirmada por enlace de correo), marca también `accionada_at` para que
    // el portal muestre "Aprobada" en vez de solo "Vista".
    if (opts.accionar) patch.accionada_at = nowIso;
    const { data, error } = await admin
      .from("notificaciones")
      .update(patch)
      .eq("entidad_tipo", refTabla)
      .eq("entidad_id", refId)
      .is("vista_at", null)
      .select("id");
    if (error) throw error;
    return { ok: true, cerradas: (data ?? []).length };
  } catch (err) {
    console.error("[notificaciones] marcarNotificacionesVistasPorRef:", err);
    return { ok: false, cerradas: 0 };
  }
}

// Registro para Dirección (gestor): todas las de la empresa activa.
export interface NotificacionRegistro extends NotificacionApp {
  destinatario: string;
  estado: "No vista" | "Vista" | "Accionada";
}

export async function listRegistroNotificaciones(): Promise<NotificacionRegistro[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return [];
    const { data, error } = await supabase
      .from("notificaciones")
      .select(
        "id, tipo, titulo, mensaje, payload, accion_label, requiere_accion, vista_at, accionada_at, created_at, entidad_tipo, entidad_id, empleado_id, usuario_id, empleados(nombre, apellidos)",
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((r) => {
      const row = r as NotifDbRow & {
        empleados?: { nombre?: string; apellidos?: string } | { nombre?: string; apellidos?: string }[] | null;
      };
      const emp = Array.isArray(row.empleados) ? row.empleados[0] : row.empleados;
      const destinatario = emp ? `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim() : "—";
      const estado: NotificacionRegistro["estado"] = row.accionada_at
        ? "Accionada"
        : row.vista_at
          ? "Vista"
          : "No vista";
      return { ...dbToApp(row), destinatario: destinatario || "—", estado };
    });
  } catch (err) {
    console.error("[notificaciones] listRegistroNotificaciones:", err);
    return [];
  }
}

// ── Emisión (gestor) ────────────────────────────────────────────────
// Inserta notificaciones. Usa el cliente del usuario (RLS: gestor).
export interface NuevaNotificacion {
  empleadoId: string | null;
  usuarioId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  payload?: Record<string, unknown>;
  accionLabel?: string;
  requiereAccion?: boolean;
  refTabla?: string | null;
  refId?: string | null;
  accionUrl?: string | null;
  /** Clave de idempotencia (emisores por cron/evento). */
  dedupeKey?: string | null;
}

// Núcleo de inserción compartido por `crearNotificaciones` y `emitirNotificacion`.
// Si alguna fila trae `dedupeKey`, usa upsert ignorando duplicados (idempotencia
// vía índice único parcial notificaciones_dedupe_uq).
async function insertNotifRows(
  supabase: SupabaseClient,
  empresaId: string,
  createdBy: string | null,
  rows: NuevaNotificacion[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const filas = rows.map((n) => ({
    empresa_id: empresaId,
    empleado_id: n.empleadoId,
    usuario_id: n.usuarioId,
    tipo: n.tipo,
    titulo: n.titulo,
    mensaje: n.mensaje,
    payload: n.payload ?? {},
    accion_label: n.accionLabel ?? "Visto",
    requiere_accion: n.requiereAccion ?? false,
    entidad_tipo: n.refTabla ?? null,
    entidad_id: n.refId ?? null,
    accion_url: n.accionUrl ?? null,
    dedupe_key: n.dedupeKey ?? null,
    created_by: createdBy,
  }));
  const conDedupe = filas.some((f) => f.dedupe_key !== null);
  const query = conDedupe
    ? supabase
        .from("notificaciones")
        .upsert(filas, { onConflict: "empresa_id,usuario_id,dedupe_key", ignoreDuplicates: true })
        .select("id")
    : supabase.from("notificaciones").insert(filas).select("id");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length;
}

export async function crearNotificaciones(
  rows: NuevaNotificacion[],
): Promise<{ ok: boolean; creadas: number }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || rows.length === 0) return { ok: false, creadas: 0 };
    const creadas = await insertNotifRows(supabase as unknown as SupabaseClient, empresaId, userId, rows);
    return { ok: true, creadas };
  } catch (err) {
    console.error("[notificaciones] crearNotificaciones:", err);
    return { ok: false, creadas: 0 };
  }
}

// ── Motor de alertas (PRP-065) ──────────────────────────────────────
// Capa única de emisión: resuelve destinatarios de un segmento, inserta una fila
// por destinatario (con dedup opcional) y deja traza en el registro. Envuelve el
// núcleo de inserción ya existente; no lo reemplaza.
//
//  - Aviso manual de un gestor → cliente del usuario (RLS gestor).
//  - Eventos/crons del sistema (input.system) o sin sesión → service role.
export async function emitirNotificacion(input: EmitirInput): Promise<EmitirResultado> {
  try {
    const ctx = await getAppContext();
    const empresaId = input.empresaId ?? ctx.empresaId;
    if (!empresaId) return { ok: false, destinatarios: 0, creadas: 0 };

    const useService = input.system === true || !ctx.userId;
    const supabase = (useService
      ? createAdminClient()
      : ctx.supabase) as unknown as SupabaseClient;
    const createdBy = ctx.userId;

    const destinatarios = await resolverDestinatarios(supabase, empresaId, input.segmento);
    if (destinatarios.length === 0) return { ok: true, destinatarios: 0, creadas: 0 };

    const meta = getTipoMeta(input.tipo);
    const rows: NuevaNotificacion[] = destinatarios.map((d) => ({
      empleadoId: d.empleadoId,
      usuarioId: d.usuarioId,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje ?? "",
      payload: input.payload,
      accionLabel: input.accionLabel ?? meta.accionLabel,
      requiereAccion: input.requiereAccion ?? meta.requiereAccion,
      refTabla: input.refTabla ?? null,
      refId: input.refId ?? null,
      accionUrl: input.accionUrl ?? null,
      dedupeKey: input.dedupeKey ?? null,
    }));
    const creadas = await insertNotifRows(supabase, empresaId, createdBy, rows);

    // Canal push "alertas": llega al móvil de los destinatarios con opt-in
    // (usuarios.push_alertas). Siempre con cliente service (debe leer las
    // suscripciones de otros usuarios). Desactivable con input.push = false
    // (p. ej. comunicados, que ya disparan su propio push).
    if (input.push !== false && creadas > 0) {
      try {
        const { sendPushWithClient } = await import("@/features/mi-panel/mobile/lib/push-server");
        const pushClient = (useService ? supabase : createAdminClient()) as unknown as SupabaseClient;
        const body = (input.mensaje ?? "").trim() || meta.label;
        await Promise.all(
          destinatarios.map((d) =>
            sendPushWithClient(pushClient, {
              userId: d.usuarioId,
              empresaId,
              eventType: "alerta",
              payload: {
                title: input.titulo,
                body,
                url: input.accionUrl || "/",
                tag: input.dedupeKey || `notif-${input.tipo}`,
              },
            }),
          ),
        );
      } catch (e) {
        console.error("[notificaciones] push alertas:", e);
      }
    }

    return { ok: true, destinatarios: destinatarios.length, creadas };
  } catch (err) {
    console.error("[notificaciones] emitirNotificacion:", err);
    return { ok: false, destinatarios: 0, creadas: 0 };
  }
}
