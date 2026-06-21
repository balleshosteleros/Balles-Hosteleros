"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/supabase/get-context";

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
}

export async function crearNotificaciones(
  rows: NuevaNotificacion[],
): Promise<{ ok: boolean; creadas: number }> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || rows.length === 0) return { ok: false, creadas: 0 };
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
      created_by: userId,
    }));
    const { data, error } = await supabase.from("notificaciones").insert(filas).select("id");
    if (error) throw error;
    return { ok: true, creadas: (data ?? []).length };
  } catch (err) {
    console.error("[notificaciones] crearNotificaciones:", err);
    return { ok: false, creadas: 0 };
  }
}
