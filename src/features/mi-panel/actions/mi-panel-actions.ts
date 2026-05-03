"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  DiaCalendario,
  MiFichajeHoy,
  SolicitudEstado,
  SolicitudPersonal,
  SolicitudSubtipo,
  SolicitudTipo,
  SolicitudSubtipoAusencia,
  SolicitudSubtipoTrabajo,
} from "@/features/mi-panel/types";

function extractErrorMessage(err: unknown): string {
  if (!err) return "Error desconocido";
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint, e.code ? `[${e.code}]` : null].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Error desconocido";
  }
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      empresaId: null,
      nombre: null,
      departamento: null,
      rolLabel: null,
    };
  }
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id, nombre, apellidos, departamento, rol_label")
    .eq("user_id", user.id)
    .single();
  const nombreCompleto = data
    ? `${data.nombre ?? ""} ${data.apellidos ?? ""}`.trim()
    : "";
  const fallbackEmail = user.email?.split("@")[0] ?? "";
  return {
    supabase,
    user,
    empresaId: (data?.empresa_id as string | undefined) ?? null,
    nombre: nombreCompleto || fallbackEmail || null,
    departamento: (data?.departamento as string | undefined) ?? null,
    rolLabel: (data?.rol_label as string | undefined) ?? null,
  };
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function monthBounds(anio: number, mes: number) {
  const start = new Date(Date.UTC(anio, mes - 1, 1));
  const end = new Date(Date.UTC(anio, mes, 1));
  return {
    desde: start.toISOString().split("T")[0],
    hasta: end.toISOString().split("T")[0],
  };
}

// ─── FICHAJE ─────────────────────────────────────────────────

export async function getMiFichajeHoy(): Promise<{
  ok: boolean;
  data: MiFichajeHoy | null;
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: null, error: "No autenticado" };
    const { data, error } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", user.id)
      .eq("fecha", todayISO())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id: data.id as string,
        fecha: data.fecha as string,
        horaEntrada: (data.hora_entrada as string | null) ?? null,
        horaSalida: (data.hora_salida as string | null) ?? null,
        pausaInicio: (data.pausa_inicio as string | null) ?? null,
        pausaFin: (data.pausa_fin as string | null) ?? null,
        horasTotales: (data.horas_totales as number | null) ?? 0,
        estado: (data.estado as string | null) ?? "pendiente",
      },
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiFichajeHoy:", msg);
    return { ok: false, data: null, error: msg };
  }
}

export async function ficharEntradaPersonal() {
  try {
    const { supabase, user, empresaId, nombre } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };
    const ahora = new Date();
    const { data, error } = await supabase
      .from("fichajes")
      .insert({
        empresa_id: empresaId,
        empleado_id: user.id,
        empleado_nombre: nombre || "Sin nombre",
        fecha: todayISO(),
        hora_entrada: ahora.toISOString(),
        estado: "trabajando",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] ficharEntradaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function ficharSalidaPersonal(fichajeId: string) {
  try {
    const { supabase } = await getContext();
    const { data: fichaje, error: fetchErr } = await supabase
      .from("fichajes")
      .select("hora_entrada")
      .eq("id", fichajeId)
      .single();
    if (fetchErr) throw fetchErr;

    const ahora = new Date();
    let horasTotales = 0;
    if (fichaje?.hora_entrada) {
      const entrada = new Date(fichaje.hora_entrada as string);
      horasTotales =
        Math.round(((ahora.getTime() - entrada.getTime()) / 3600000) * 10000) / 10000;
    }
    const { error } = await supabase
      .from("fichajes")
      .update({
        hora_salida: ahora.toISOString(),
        horas_totales: horasTotales,
        estado: "completado",
      })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true, data: { horas_totales: horasTotales } };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] ficharSalidaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function iniciarPausaPersonal(fichajeId: string) {
  try {
    const { supabase } = await getContext();
    const ahora = new Date().toTimeString().slice(0, 8);
    const { error } = await supabase
      .from("fichajes")
      .update({ pausa_inicio: ahora, estado: "pausa" })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] iniciarPausaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function finalizarPausaPersonal(fichajeId: string) {
  try {
    const { supabase } = await getContext();
    const ahora = new Date().toTimeString().slice(0, 8);
    const { error } = await supabase
      .from("fichajes")
      .update({ pausa_fin: ahora, estado: "trabajando" })
      .eq("id", fichajeId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] finalizarPausaPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function listarMisFichajes(limite = 60): Promise<{
  ok: boolean;
  data: MiFichajeHoy[];
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { data, error } = await supabase
      .from("fichajes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("empleado_id", user.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        fecha: f.fecha as string,
        horaEntrada: (f.hora_entrada as string | null) ?? null,
        horaSalida: (f.hora_salida as string | null) ?? null,
        pausaInicio: (f.pausa_inicio as string | null) ?? null,
        pausaFin: (f.pausa_fin as string | null) ?? null,
        horasTotales: (f.horas_totales as number | null) ?? 0,
        estado: (f.estado as string | null) ?? "pendiente",
      })),
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarMisFichajes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export interface ComunicadoVisible {
  id: string;
  titulo: string;
  contenido: string;
  prioridad: string;
  createdAt: string;
}

export async function listarComunicadosVisibles(): Promise<{
  ok: boolean;
  data: ComunicadoVisible[];
  error?: string;
}> {
  try {
    const { supabase, user, empresaId, departamento, rolLabel } =
      await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data, error } = await supabase
      .from("comunicados")
      .select(
        "id, titulo, cuerpo, prioridad, created_at, estado, toda_empresa, roles_destinatarios, empleados_destinatarios, departamentos_destinatarios",
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const dep = (departamento ?? "").trim().toLowerCase();
    const rol = (rolLabel ?? "").trim().toLowerCase();

    const visibles = (data ?? []).filter((c: Record<string, unknown>) => {
      const estado = (c.estado as string | undefined) ?? "publicado";
      if (estado === "borrador" || estado === "archivado") return false;

      // Difusión a toda la empresa: visible para todos.
      if ((c.toda_empresa as boolean | undefined) === true) return true;

      const empleados = (c.empleados_destinatarios as string[] | undefined) ?? [];
      if (empleados.includes(user.id)) return true;

      const departamentos = (
        c.departamentos_destinatarios as string[] | undefined
      ) ?? [];
      if (
        dep &&
        departamentos.some((d) => (d ?? "").trim().toLowerCase() === dep)
      ) {
        return true;
      }

      const roles = (c.roles_destinatarios as string[] | undefined) ?? [];
      const rolesLower = roles.map((r) => (r ?? "").trim().toLowerCase());
      if (rol && rolesLower.includes(rol)) return true;
      if (dep && rolesLower.includes(dep)) return true;

      return false;
    });

    return {
      ok: true,
      data: visibles.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        titulo: (c.titulo as string) ?? "",
        contenido: (c.cuerpo as string | null | undefined) ?? "",
        prioridad: (c.prioridad as string) ?? "normal",
        createdAt: c.created_at as string,
      })),
    };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarComunicadosVisibles:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── CALENDARIO MENSUAL ──────────────────────────────────────

export async function getMiCalendarioMes(
  anio: number,
  mes: number,
): Promise<{ ok: boolean; data: DiaCalendario[]; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { desde, hasta } = monthBounds(anio, mes);

    const [fichajesRes, solicitudesRes] = await Promise.all([
      supabase
        .from("fichajes")
        .select("fecha, horas_totales, estado")
        .eq("empresa_id", empresaId)
        .eq("empleado_id", user.id)
        .gte("fecha", desde)
        .lt("fecha", hasta),
      supabase
        .from("solicitudes_personal")
        .select("tipo, subtipo, fecha_inicio, fecha_fin, estado")
        .eq("empresa_id", empresaId)
        .eq("user_id", user.id)
        .eq("estado", "aprobada")
        .or(`fecha_inicio.lt.${hasta},fecha_fin.gte.${desde}`),
    ]);

    if (fichajesRes.error) throw fichajesRes.error;
    if (solicitudesRes.error) throw solicitudesRes.error;

    const map = new Map<string, DiaCalendario>();
    for (const f of fichajesRes.data ?? []) {
      const fecha = f.fecha as string;
      const prev = map.get(fecha) ?? {
        fecha,
        fichado: false,
        horasFichaje: 0,
        ausencia: null,
        trabajoExtra: null,
      };
      prev.fichado = true;
      prev.horasFichaje = (f.horas_totales as number | null) ?? 0;
      map.set(fecha, prev);
    }

    for (const s of solicitudesRes.data ?? []) {
      const ini = new Date((s.fecha_inicio as string) + "T00:00:00Z");
      const fin = new Date(((s.fecha_fin as string | null) ?? (s.fecha_inicio as string)) + "T00:00:00Z");
      const startBound = new Date(desde + "T00:00:00Z");
      const endBound = new Date(hasta + "T00:00:00Z");
      const cur = new Date(Math.max(ini.getTime(), startBound.getTime()));
      const stop = new Date(Math.min(fin.getTime(), endBound.getTime() - 86400000));
      while (cur.getTime() <= stop.getTime()) {
        const key = cur.toISOString().split("T")[0];
        const prev = map.get(key) ?? {
          fecha: key,
          fichado: false,
          horasFichaje: 0,
          ausencia: null,
          trabajoExtra: null,
        };
        if (s.tipo === "ausencia") {
          prev.ausencia = s.subtipo as SolicitudSubtipoAusencia;
        } else if (s.tipo === "trabajo") {
          prev.trabajoExtra = s.subtipo as SolicitudSubtipoTrabajo;
        }
        map.set(key, prev);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    return { ok: true, data: Array.from(map.values()) };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] getMiCalendarioMes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─── SOLICITUDES ─────────────────────────────────────────────

function mapSolicitud(row: Record<string, unknown>): SolicitudPersonal {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    userId: row.user_id as string,
    empleadoNombre: (row.empleado_nombre as string) ?? "",
    tipo: row.tipo as SolicitudTipo,
    subtipo: row.subtipo as SolicitudSubtipo,
    fechaInicio: row.fecha_inicio as string,
    fechaFin: (row.fecha_fin as string | null) ?? null,
    horas: (row.horas as number | null) ?? null,
    motivo: (row.motivo as string) ?? "",
    estado: row.estado as SolicitudEstado,
    createdAt: row.created_at as string,
  };
}

export async function listarMisSolicitudes(limite = 20): Promise<{
  ok: boolean;
  data: SolicitudPersonal[];
  error?: string;
}> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!user || !empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { data, error } = await supabase
      .from("solicitudes_personal")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(mapSolicitud) };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarMisSolicitudes:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export interface NuevaSolicitudInput {
  tipo: SolicitudTipo;
  subtipo: SolicitudSubtipo;
  fechaInicio: string;
  fechaFin?: string | null;
  horas?: number | null;
  motivo?: string;
}

export async function crearSolicitudPersonal(input: NuevaSolicitudInput) {
  try {
    const { supabase, user, empresaId, nombre } = await getContext();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    if (input.tipo === "ausencia" && !["baja_medica", "vacaciones", "permiso"].includes(input.subtipo)) {
      return { ok: false, error: "Subtipo de ausencia no válido" };
    }
    if (input.tipo === "trabajo" && !["horas_extras", "dia_trabajado"].includes(input.subtipo)) {
      return { ok: false, error: "Subtipo de trabajo no válido" };
    }

    const { data, error } = await supabase
      .from("solicitudes_personal")
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        empleado_nombre: nombre || "Sin nombre",
        tipo: input.tipo,
        subtipo: input.subtipo,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin ?? null,
        horas: input.horas ?? null,
        motivo: input.motivo ?? "",
        estado: "pendiente",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: mapSolicitud(data as Record<string, unknown>) };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] crearSolicitudPersonal:", msg);
    return { ok: false, error: msg };
  }
}

export async function anularMiSolicitud(id: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("solicitudes_personal")
      .update({ estado: "anulada" })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("estado", "pendiente");
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] anularMiSolicitud:", msg);
    return { ok: false, error: msg };
  }
}

// ─── ADMIN / RRHH: gestión de solicitudes ──────────────────

export async function listarSolicitudesEmpresa(filtro: "pendientes" | "todas" = "pendientes") {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    const query = supabase
      .from("solicitudes_personal")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtro === "pendientes") query.eq("estado", "pendiente");
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(mapSolicitud) };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] listarSolicitudesEmpresa:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export async function aprobarSolicitud(id: string, notasRevision?: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("solicitudes_personal")
      .update({
        estado: "aprobada",
        revisado_por: user.id,
        revisado_at: new Date().toISOString(),
        notas_revision: notasRevision ?? null,
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] aprobarSolicitud:", msg);
    return { ok: false, error: msg };
  }
}

export async function rechazarSolicitud(id: string, notasRevision?: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("solicitudes_personal")
      .update({
        estado: "rechazada",
        revisado_por: user.id,
        revisado_at: new Date().toISOString(),
        notas_revision: notasRevision ?? null,
      })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    console.error("[mi-panel] rechazarSolicitud:", msg);
    return { ok: false, error: msg };
  }
}
