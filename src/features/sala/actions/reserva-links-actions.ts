"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReservaUrl,
  validarPalabraClave,
  type ReservaLink,
} from "@/features/sala/data/reserva-links";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, empresaSlug: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  let empresaSlug: string | null = null;
  if (empresaId) {
    const { data } = await supabase.from("empresas").select("slug").eq("id", empresaId).maybeSingle();
    empresaSlug = (data?.slug as string) ?? null;
  }
  return { supabase, user, empresaId, empresaSlug };
}

type Row = Record<string, unknown>;

function rowToLink(row: Row, empresaSlug: string | null = null, ticketProductoIds: string[] = []): ReservaLink {
  const palabraClave = row.palabra_clave as string;
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    palabraClave,
    urlGenerada: empresaSlug ? buildReservaUrl(empresaSlug, palabraClave) : (row.url_generada as string),
    activo: row.activo as boolean,
    creadoPor: (row.creado_por as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    nombre: (row.nombre as string | null) ?? null,
    vendeTickets: (row.vende_tickets as boolean) ?? false,
    ticketProductoIds,
  };
}

export async function listReservaLinks() {
  try {
    const { supabase, empresaId, empresaSlug } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaLink[], error: "Sin empresa" };
    const { data, error } = await supabase
      .from("reserva_links")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const linkIds = rows.map((r) => r.id as string);
    let pivotMap: Map<string, string[]> = new Map();
    if (linkIds.length > 0) {
      const pivot = await supabase
        .from("reserva_link_ticket_productos")
        .select("link_id,producto_id,orden")
        .in("link_id", linkIds)
        .order("orden", { ascending: true });
      if (pivot.error) throw pivot.error;
      pivotMap = (pivot.data ?? []).reduce((acc, p) => {
        const arr = acc.get(p.link_id as string) ?? [];
        arr.push(p.producto_id as string);
        acc.set(p.link_id as string, arr);
        return acc;
      }, new Map<string, string[]>());
    }
    return {
      ok: true,
      data: rows.map((row) => rowToLink(row, empresaSlug, pivotMap.get(row.id as string) ?? [])),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, data: [] as ReservaLink[], error: msg };
  }
}

export interface CreateReservaLinkInput {
  palabraClave: string;
  nombre?: string | null;
  vendeTickets?: boolean;
  ticketProductoIds?: string[];
}

export async function createReservaLink(input: string | CreateReservaLinkInput) {
  try {
    const normalized: CreateReservaLinkInput =
      typeof input === "string" ? { palabraClave: input } : input;
    const v = validarPalabraClave(normalized.palabraClave);
    if (!v.ok) return { ok: false, error: v.error };
    const { supabase, user, empresaId, empresaSlug } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    if (!empresaSlug) return { ok: false, error: "La empresa no tiene slug configurado" };
    const url = buildReservaUrl(empresaSlug, v.valor);
    const vendeTickets = Boolean(normalized.vendeTickets);
    const productoIds = vendeTickets ? (normalized.ticketProductoIds ?? []) : [];
    if (vendeTickets && productoIds.length === 0) {
      return { ok: false, error: "Selecciona al menos un producto-ticket" };
    }
    const { data, error } = await supabase
      .from("reserva_links")
      .insert({
        empresa_id: empresaId,
        palabra_clave: v.valor,
        url_generada: url,
        creado_por: user?.id ?? null,
        nombre: normalized.nombre?.trim() || null,
        vende_tickets: vendeTickets,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya existe un link con esa palabra clave" };
      throw error;
    }
    if (productoIds.length > 0) {
      const pivotRows = productoIds.map((pid, idx) => ({
        link_id: data.id as string,
        producto_id: pid,
        orden: idx,
      }));
      const pivot = await supabase.from("reserva_link_ticket_productos").insert(pivotRows);
      if (pivot.error) throw pivot.error;
    }
    revalidatePath("/sala/reservas/links");
    return { ok: true, data: rowToLink(data, empresaSlug, productoIds) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function updateReservaLink(
  id: string,
  updates: { nombre?: string | null; vendeTickets?: boolean; ticketProductoIds?: string[] },
) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const patch: Record<string, unknown> = {};
    if (updates.nombre !== undefined) patch.nombre = updates.nombre?.trim() || null;
    if (updates.vendeTickets !== undefined) patch.vende_tickets = updates.vendeTickets;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("reserva_links")
        .update(patch)
        .eq("id", id)
        .eq("empresa_id", empresaId);
      if (error) throw error;
    }

    if (updates.ticketProductoIds !== undefined) {
      const del = await supabase.from("reserva_link_ticket_productos").delete().eq("link_id", id);
      if (del.error) throw del.error;
      const desired = updates.vendeTickets === false ? [] : updates.ticketProductoIds;
      if (desired.length > 0) {
        const pivotRows = desired.map((pid, idx) => ({
          link_id: id,
          producto_id: pid,
          orden: idx,
        }));
        const ins = await supabase.from("reserva_link_ticket_productos").insert(pivotRows);
        if (ins.error) throw ins.error;
      }
    }
    revalidatePath("/sala/reservas/links");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function toggleReservaLink(id: string, activo: boolean) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { error } = await supabase
      .from("reserva_links")
      .update({ activo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/sala/reservas/links");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function deleteReservaLink(id: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { error } = await supabase
      .from("reserva_links")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/sala/reservas/links");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}
