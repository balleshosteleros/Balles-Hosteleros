"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { CATALOGO_REVISIONES, MESES_PERIODICIDAD, type PeriodicidadRevision } from "@/features/gerencia/data/catalogo-revisiones";

export interface RevisionRow {
  id: string;
  clave: string | null;
  nombre: string;
  ambito: string;
  periodicidad: string;
  fecha_ultima: string | null;
  fecha_vencimiento: string | null;
  responsable: string | null;
  proveedor: string | null;
  coste: number | null;
  notas: string | null;
  activo: boolean;
}

export interface HistorialRow {
  id: string;
  revision_id: string;
  fecha: string;
  resultado: string;
  realizado_por: string | null;
  observaciones: string | null;
  documento_url: string | null;
}

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

/** Suma la periodicidad a una fecha para saber cuándo toca la siguiente. */
function calcularProximoVencimiento(desde: string, periodicidad: string): string | null {
  const meses = MESES_PERIODICIDAD[periodicidad as PeriodicidadRevision];
  if (meses === null || meses === undefined) return null;
  const fecha = new Date(`${desde}T00:00:00`);
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString().slice(0, 10);
}

export async function listRevisiones(): Promise<{ ok: boolean; data: RevisionRow[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("revisiones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as RevisionRow[] };
  } catch (err) {
    console.error("[revisiones] listRevisiones:", err);
    return { ok: false, data: [] };
  }
}

export async function listHistorial(revisionId: string): Promise<{ ok: boolean; data: HistorialRow[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("revisiones_historial")
      .select("*")
      .eq("revision_id", revisionId)
      .eq("empresa_id", empresaId)
      .order("fecha", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as HistorialRow[] };
  } catch (err) {
    console.error("[revisiones] listHistorial:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Crea en la empresa las obligaciones del catálogo que todavía no existen.
 * Es idempotente: se puede llamar tantas veces como haga falta.
 */
export async function sembrarCatalogo(): Promise<{ ok: boolean; creadas: number; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, creadas: 0, error: "No autenticado" };

    const { data: existentes, error: errExist } = await supabase
      .from("revisiones")
      .select("clave")
      .eq("empresa_id", empresaId);
    if (errExist) throw errExist;

    const yaEstan = new Set((existentes ?? []).map((r) => r.clave));
    const nuevas = CATALOGO_REVISIONES.filter((c) => !yaEstan.has(c.clave)).map((c) => ({
      empresa_id: empresaId,
      clave: c.clave,
      nombre: c.nombre,
      ambito: c.ambito,
      periodicidad: c.periodicidad,
      fecha_ultima: null,
      fecha_vencimiento: null,
      responsable: null,
      proveedor: null,
      notas: null,
      activo: true,
    }));

    if (nuevas.length === 0) return { ok: true, creadas: 0 };

    const { error } = await supabase.from("revisiones").insert(nuevas);
    if (error) throw error;
    return { ok: true, creadas: nuevas.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[revisiones] sembrarCatalogo:", msg);
    return { ok: false, creadas: 0, error: msg };
  }
}

export async function createRevision(input: {
  nombre: string;
  ambito: string;
  periodicidad: string;
  fecha_vencimiento?: string | null;
  responsable?: string | null;
  proveedor?: string | null;
  notas?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };

    const { error } = await supabase.from("revisiones").insert({
      empresa_id: empresaId,
      clave: null,
      nombre: input.nombre.trim(),
      ambito: input.ambito,
      periodicidad: input.periodicidad,
      fecha_vencimiento: input.fecha_vencimiento || null,
      responsable: input.responsable || null,
      proveedor: input.proveedor || null,
      notas: input.notas || null,
      activo: true,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[revisiones] createRevision:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateRevision(
  id: string,
  input: {
    nombre?: string;
    ambito?: string;
    periodicidad?: string;
    fecha_vencimiento?: string | null;
    fecha_ultima?: string | null;
    responsable?: string | null;
    proveedor?: string | null;
    coste?: number | null;
    notas?: string | null;
    activo?: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("revisiones")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[revisiones] updateRevision:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Anota una revisión realizada: la guarda en el historial y recalcula
 * automáticamente cuándo toca la siguiente según su periodicidad.
 */
export async function registrarRevision(input: {
  revision_id: string;
  fecha: string;
  resultado: string;
  realizado_por?: string | null;
  observaciones?: string | null;
  documento_url?: string | null;
}): Promise<{ ok: boolean; proximaFecha?: string | null; error?: string }> {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: revision, error: errRev } = await supabase
      .from("revisiones")
      .select("id, periodicidad")
      .eq("id", input.revision_id)
      .eq("empresa_id", empresaId)
      .single();
    if (errRev) throw errRev;

    const { error: errHist } = await supabase.from("revisiones_historial").insert({
      revision_id: input.revision_id,
      empresa_id: empresaId,
      fecha: input.fecha,
      resultado: input.resultado,
      realizado_por: input.realizado_por || null,
      observaciones: input.observaciones || null,
      documento_url: input.documento_url || null,
      created_by: user?.id ?? null,
    });
    if (errHist) throw errHist;

    const proximaFecha = calcularProximoVencimiento(input.fecha, revision.periodicidad);
    const { error: errUpd } = await supabase
      .from("revisiones")
      .update({
        fecha_ultima: input.fecha,
        fecha_vencimiento: proximaFecha,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.revision_id)
      .eq("empresa_id", empresaId);
    if (errUpd) throw errUpd;

    return { ok: true, proximaFecha };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[revisiones] registrarRevision:", msg);
    return { ok: false, error: msg };
  }
}
