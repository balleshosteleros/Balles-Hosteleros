"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EtiquetaScope = "reserva" | "cliente";

export interface EtiquetaCategoria {
  id: string;
  empresaId: string;
  scope: EtiquetaScope;
  nombre: string;
  orden: number;
  sistema: boolean;
  activo: boolean;
}

export interface Etiqueta {
  id: string;
  empresaId: string;
  categoriaId: string | null;
  scope: EtiquetaScope;
  nombre: string;
  emoji: string | null;
  color: string;
  orden: number;
  sistema: boolean;
  activo: boolean;
}

export interface EtiquetaConOrigen extends Etiqueta {
  /** "reserva" si proviene de la reserva concreta; "cliente" si viene del cliente vinculado. */
  origen: "reserva" | "cliente";
}

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

function rowToCategoria(row: Record<string, unknown>): EtiquetaCategoria {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    scope: row.scope as EtiquetaScope,
    nombre: row.nombre as string,
    orden: (row.orden as number) ?? 0,
    sistema: (row.sistema as boolean) ?? false,
    activo: (row.activo as boolean) ?? true,
  };
}

function rowToEtiqueta(row: Record<string, unknown>): Etiqueta {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    categoriaId: (row.categoria_id as string | null) ?? null,
    scope: row.scope as EtiquetaScope,
    nombre: row.nombre as string,
    emoji: (row.emoji as string | null) ?? null,
    color: (row.color as string) ?? "#64748b",
    orden: (row.orden as number) ?? 0,
    sistema: (row.sistema as boolean) ?? false,
    activo: (row.activo as boolean) ?? true,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────────────────────────────────

export async function listEtiquetaCategorias(scope?: EtiquetaScope) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as EtiquetaCategoria[] };
    const q = supabase
      .from("sala_etiqueta_categorias")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (scope) q.eq("scope", scope);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToCategoria) };
  } catch (err) {
    console.error("[sala-etiquetas] listCategorias:", err);
    return { ok: false, data: [] as EtiquetaCategoria[] };
  }
}

export async function createEtiquetaCategoria(input: {
  scope: EtiquetaScope;
  nombre: string;
  orden?: number;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };
    const { data, error } = await supabase
      .from("sala_etiqueta_categorias")
      .insert({
        empresa_id: empresaId,
        scope: input.scope,
        nombre: input.nombre.trim(),
        orden: input.orden ?? 99,
        sistema: false,
        activo: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: data ? rowToCategoria(data) : null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] createCategoria:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateEtiquetaCategoria(id: string, updates: {
  nombre?: string;
  orden?: number;
  activo?: boolean;
}) {
  try {
    const { supabase } = await getCtx();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.nombre !== undefined) dbUpdates.nombre = updates.nombre.trim();
    if (updates.orden !== undefined) dbUpdates.orden = updates.orden;
    if (updates.activo !== undefined) dbUpdates.activo = updates.activo;
    const { error } = await supabase
      .from("sala_etiqueta_categorias")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] updateCategoria:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEtiquetaCategoria(id: string) {
  try {
    const { supabase } = await getCtx();
    // Solo se pueden borrar categorías no-sistema (chequeo defensivo aquí
    // además del bloqueo de la UI).
    const { data: cat } = await supabase
      .from("sala_etiqueta_categorias")
      .select("sistema")
      .eq("id", id)
      .maybeSingle();
    if (cat?.sistema) {
      return { ok: false, error: "Las categorías del sistema no se pueden borrar." };
    }
    const { error } = await supabase
      .from("sala_etiqueta_categorias")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] deleteCategoria:", msg);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ETIQUETAS
// ─────────────────────────────────────────────────────────────────────────

export async function listEtiquetas(opts?: {
  scope?: EtiquetaScope;
  soloActivas?: boolean;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as Etiqueta[] };
    const q = supabase
      .from("sala_etiquetas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (opts?.scope) q.eq("scope", opts.scope);
    if (opts?.soloActivas) q.eq("activo", true);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToEtiqueta) };
  } catch (err) {
    console.error("[sala-etiquetas] listEtiquetas:", err);
    return { ok: false, data: [] as Etiqueta[] };
  }
}

export async function createEtiqueta(input: {
  scope: EtiquetaScope;
  categoriaId: string | null;
  nombre: string;
  emoji?: string | null;
  color?: string;
  orden?: number;
}) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" };
    const { data, error } = await supabase
      .from("sala_etiquetas")
      .insert({
        empresa_id: empresaId,
        categoria_id: input.categoriaId,
        scope: input.scope,
        nombre: input.nombre.trim(),
        emoji: input.emoji ?? null,
        color: input.color ?? "#64748b",
        orden: input.orden ?? 99,
        sistema: false,
        activo: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, data: data ? rowToEtiqueta(data) : null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] createEtiqueta:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateEtiqueta(id: string, updates: {
  nombre?: string;
  emoji?: string | null;
  color?: string;
  orden?: number;
  activo?: boolean;
  categoriaId?: string | null;
}) {
  try {
    const { supabase } = await getCtx();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.nombre !== undefined) dbUpdates.nombre = updates.nombre.trim();
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.orden !== undefined) dbUpdates.orden = updates.orden;
    if (updates.activo !== undefined) dbUpdates.activo = updates.activo;
    if (updates.categoriaId !== undefined) dbUpdates.categoria_id = updates.categoriaId;
    const { error } = await supabase
      .from("sala_etiquetas")
      .update(dbUpdates)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] updateEtiqueta:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteEtiqueta(id: string) {
  try {
    const { supabase } = await getCtx();
    const { data: et } = await supabase
      .from("sala_etiquetas")
      .select("sistema")
      .eq("id", id)
      .maybeSingle();
    if (et?.sistema) {
      return { ok: false, error: "Las etiquetas del sistema no se pueden borrar; desactívalas en su lugar." };
    }
    const { error } = await supabase
      .from("sala_etiquetas")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] deleteEtiqueta:", msg);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ASIGNACIONES — RESERVA
// ─────────────────────────────────────────────────────────────────────────

export async function listEtiquetasDeReserva(reservaId: string) {
  try {
    const { supabase } = await getCtx();
    const { data, error } = await supabase
      .from("sala_reserva_etiquetas")
      .select("etiqueta_id, sala_etiquetas(*)")
      .eq("reserva_id", reservaId);
    if (error) throw error;
    const etiquetas: Etiqueta[] = (data ?? [])
      .map((r) => r.sala_etiquetas as unknown as Record<string, unknown> | null)
      .filter((r): r is Record<string, unknown> => r !== null)
      .map(rowToEtiqueta);
    return { ok: true, data: etiquetas };
  } catch (err) {
    console.error("[sala-etiquetas] listDeReserva:", err);
    return { ok: false, data: [] as Etiqueta[] };
  }
}

export async function setEtiquetasReserva(reservaId: string, etiquetaIds: string[]) {
  try {
    const { supabase } = await getCtx();
    const { error: delErr } = await supabase
      .from("sala_reserva_etiquetas")
      .delete()
      .eq("reserva_id", reservaId);
    if (delErr) throw delErr;
    if (etiquetaIds.length > 0) {
      const rows = etiquetaIds.map((etiqueta_id) => ({ reserva_id: reservaId, etiqueta_id }));
      const { error: insErr } = await supabase
        .from("sala_reserva_etiquetas")
        .insert(rows);
      if (insErr) throw insErr;
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] setEtiquetasReserva:", msg);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ASIGNACIONES — CLIENTE
// ─────────────────────────────────────────────────────────────────────────

export async function listEtiquetasDeCliente(clienteId: string) {
  try {
    const { supabase } = await getCtx();
    const { data, error } = await supabase
      .from("sala_cliente_etiquetas")
      .select("etiqueta_id, sala_etiquetas(*)")
      .eq("cliente_id", clienteId);
    if (error) throw error;
    const etiquetas: Etiqueta[] = (data ?? [])
      .map((r) => r.sala_etiquetas as unknown as Record<string, unknown> | null)
      .filter((r): r is Record<string, unknown> => r !== null)
      .map(rowToEtiqueta);
    return { ok: true, data: etiquetas };
  } catch (err) {
    console.error("[sala-etiquetas] listDeCliente:", err);
    return { ok: false, data: [] as Etiqueta[] };
  }
}

export async function setEtiquetasCliente(clienteId: string, etiquetaIds: string[]) {
  try {
    const { supabase } = await getCtx();
    const { error: delErr } = await supabase
      .from("sala_cliente_etiquetas")
      .delete()
      .eq("cliente_id", clienteId);
    if (delErr) throw delErr;
    if (etiquetaIds.length > 0) {
      const rows = etiquetaIds.map((etiqueta_id) => ({ cliente_id: clienteId, etiqueta_id }));
      const { error: insErr } = await supabase
        .from("sala_cliente_etiquetas")
        .insert(rows);
      if (insErr) throw insErr;
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sala-etiquetas] setEtiquetasCliente:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Devuelve el conjunto de etiquetas efectivas para una reserva, marcando el
 * origen de cada una: las directas de la reserva (origen='reserva') más las
 * heredadas del cliente vinculado (origen='cliente'). Sin duplicados.
 */
export async function listEtiquetasEfectivasReserva(
  reservaId: string,
  clienteId: string | null,
) {
  try {
    const [r, c] = await Promise.all([
      listEtiquetasDeReserva(reservaId),
      clienteId ? listEtiquetasDeCliente(clienteId) : Promise.resolve({ ok: true, data: [] as Etiqueta[] }),
    ]);
    const map = new Map<string, EtiquetaConOrigen>();
    for (const e of c.data ?? []) map.set(e.id, { ...e, origen: "cliente" });
    // Las etiquetas de la reserva pisan al cliente solo en cuanto al origen
    // (pero como son la misma fila, da igual; se prioriza "reserva" para que
    // la UI sepa que es removible desde la reserva concreta).
    for (const e of r.data ?? []) map.set(e.id, { ...e, origen: "reserva" });
    return { ok: true, data: Array.from(map.values()) };
  } catch (err) {
    console.error("[sala-etiquetas] efectivas:", err);
    return { ok: false, data: [] as EtiquetaConOrigen[] };
  }
}
