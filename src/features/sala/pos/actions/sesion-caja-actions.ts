"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { SesionCaja, MovimientoCaja, MovimientoCajaTipo } from "../types";

// ─── MAPPERS snake → camel ────────────────────────────────────

interface SesionCajaRow {
  id: string;
  empresa_id: string;
  empleado_id: string | null;
  abierta_at: string;
  cerrada_at: string | null;
  fondo_inicial: number | string;
  teorico_cierre: number | string | null;
  real_cierre: number | string | null;
  diferencia: number | string | null;
  estado: "ABIERTA" | "CERRADA";
  notas: string;
  created_at: string;
}

function rowToSesion(row: SesionCajaRow): SesionCaja {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    empleadoId: row.empleado_id,
    abiertaAt: row.abierta_at,
    cerradaAt: row.cerrada_at,
    fondoInicial: Number(row.fondo_inicial ?? 0),
    teoricoCierre: row.teorico_cierre == null ? null : Number(row.teorico_cierre),
    realCierre: row.real_cierre == null ? null : Number(row.real_cierre),
    diferencia: row.diferencia == null ? null : Number(row.diferencia),
    estado: row.estado,
    notas: row.notas ?? "",
    createdAt: row.created_at,
  };
}

interface MovRow {
  id: string;
  sesion_caja_id: string;
  tipo: MovimientoCajaTipo;
  importe: number | string;
  motivo: string;
  creado_at: string;
}

function rowToMov(row: MovRow): MovimientoCaja {
  return {
    id: row.id,
    sesionCajaId: row.sesion_caja_id,
    tipo: row.tipo,
    importe: Number(row.importe ?? 0),
    motivo: row.motivo ?? "",
    creadoAt: row.creado_at,
  };
}

// ─── LECTURA ──────────────────────────────────────────────────

/** Devuelve la sesión de caja abierta (si existe) del usuario/empresa. */
export async function getSesionCajaAbierta(): Promise<
  { ok: true; data: SesionCaja | null } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: null };

    const { data, error } = await supabase
      .from("pos_sesiones_caja")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("estado", "ABIERTA")
      .order("abierta_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { ok: true, data: data ? rowToSesion(data as SesionCajaRow) : null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][caja] getSesionCajaAbierta:", msg);
    return { ok: false, error: msg };
  }
}

/** Lista arqueos (por defecto últimos 30). */
export async function listSesionesCaja(limit = 30): Promise<
  { ok: true; data: SesionCaja[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("pos_sesiones_caja")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("abierta_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { ok: true, data: (data as SesionCajaRow[]).map(rowToSesion) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][caja] listSesionesCaja:", msg);
    return { ok: false, error: msg };
  }
}

// ─── APERTURA ─────────────────────────────────────────────────

/** Abre una nueva sesión de caja. Falla si ya hay una abierta. */
export async function abrirSesionCaja(input: {
  fondoInicial: number;
  notas?: string;
}): Promise<{ ok: true; data: SesionCaja } | { ok: false; error: string }> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    // Guardia: no abrir si ya hay una abierta
    const existente = await getSesionCajaAbierta();
    if (existente.ok && existente.data) {
      return { ok: false, error: "Ya existe una sesión de caja abierta." };
    }

    // profile.id = user.id en este esquema (mig 002 backfill). En dev bypass, null.
    const { data, error } = await supabase
      .from("pos_sesiones_caja")
      .insert({
        empresa_id: empresaId,
        empleado_id: userId,
        fondo_inicial: input.fondoInicial,
        notas: input.notas ?? "",
      })
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data: rowToSesion(data as SesionCajaRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][caja] abrirSesionCaja:", msg);
    return { ok: false, error: msg };
  }
}

// ─── MOVIMIENTOS (APORTE / RETIRADA) ──────────────────────────

export async function registrarMovimientoCaja(input: {
  sesionCajaId: string;
  tipo: MovimientoCajaTipo;
  importe: number;
  motivo?: string;
}): Promise<{ ok: true; data: MovimientoCaja } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("pos_movimientos_caja")
      .insert({
        sesion_caja_id: input.sesionCajaId,
        tipo: input.tipo,
        importe: input.importe,
        motivo: input.motivo ?? "",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: rowToMov(data as MovRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][caja] registrarMovimientoCaja:", msg);
    return { ok: false, error: msg };
  }
}

export async function listMovimientosCaja(sesionCajaId: string): Promise<
  { ok: true; data: MovimientoCaja[] } | { ok: false; error: string }
> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("pos_movimientos_caja")
      .select("*")
      .eq("sesion_caja_id", sesionCajaId)
      .order("creado_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data as MovRow[]).map(rowToMov) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][caja] listMovimientosCaja:", msg);
    return { ok: false, error: msg };
  }
}

// ─── TEÓRICO DE CIERRE ────────────────────────────────────────

/**
 * Calcula el teórico en efectivo al cierre:
 *   teorico = fondo_inicial + Σ pagos EFECTIVO de tickets COBRADOS de la sesión
 *           + Σ aportes − Σ retiradas
 */
export async function calcularTeoricoCierre(
  sesionCajaId: string
): Promise<{ ok: true; teorico: number } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();

    const { data: sesion, error: errSesion } = await supabase
      .from("pos_sesiones_caja")
      .select("fondo_inicial")
      .eq("id", sesionCajaId)
      .single();
    if (errSesion) throw errSesion;
    const fondo = Number(sesion?.fondo_inicial ?? 0);

    // Pagos en efectivo de tickets de esta sesión (sólo cobrados)
    const { data: pagos, error: errPagos } = await supabase
      .from("pos_pagos")
      .select("importe, medio, ticket:ticket_id(sesion_caja_id, estado)")
      .eq("medio", "EFECTIVO");
    if (errPagos) throw errPagos;

    const totalEfectivo = (pagos ?? [])
      .filter((p) => {
        const t = (p as unknown as { ticket: { sesion_caja_id: string; estado: string } | null })
          .ticket;
        return t && t.sesion_caja_id === sesionCajaId && t.estado === "COBRADO";
      })
      .reduce((acc, p) => acc + Number((p as { importe: number | string }).importe ?? 0), 0);

    // Movimientos
    const { data: movs, error: errMovs } = await supabase
      .from("pos_movimientos_caja")
      .select("tipo, importe")
      .eq("sesion_caja_id", sesionCajaId);
    if (errMovs) throw errMovs;

    let aportes = 0;
    let retiradas = 0;
    for (const m of movs ?? []) {
      const imp = Number((m as { importe: number | string }).importe ?? 0);
      if ((m as { tipo: string }).tipo === "APORTE") aportes += imp;
      else if ((m as { tipo: string }).tipo === "RETIRADA") retiradas += imp;
    }

    const teorico = fondo + totalEfectivo + aportes - retiradas;
    return { ok: true, teorico: Math.round(teorico * 100) / 100 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][caja] calcularTeoricoCierre:", msg);
    return { ok: false, error: msg };
  }
}

// ─── CIERRE ───────────────────────────────────────────────────

export async function cerrarSesionCaja(input: {
  sesionCajaId: string;
  realCierre: number;
  notas?: string;
}): Promise<{ ok: true; data: SesionCaja } | { ok: false; error: string }> {
  try {
    const { supabase } = await getAppContext();

    const teoricoRes = await calcularTeoricoCierre(input.sesionCajaId);
    if (!teoricoRes.ok) return teoricoRes;
    const teorico = teoricoRes.teorico;
    const diferencia = Math.round((input.realCierre - teorico) * 100) / 100;

    const { data, error } = await supabase
      .from("pos_sesiones_caja")
      .update({
        estado: "CERRADA",
        cerrada_at: new Date().toISOString(),
        teorico_cierre: teorico,
        real_cierre: input.realCierre,
        diferencia,
        notas: input.notas ?? undefined,
      })
      .eq("id", input.sesionCajaId)
      .select()
      .single();

    if (error) throw error;
    return { ok: true, data: rowToSesion(data as SesionCajaRow) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pos][caja] cerrarSesionCaja:", msg);
    return { ok: false, error: msg };
  }
}
