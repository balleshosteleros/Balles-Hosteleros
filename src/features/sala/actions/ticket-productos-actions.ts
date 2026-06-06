"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validarTicketInput,
  type ReservaTicketProducto,
  type ReservaTicketProductoInput,
  type TicketModoPrecio,
  type TicketStockModo,
} from "@/features/sala/data/ticket-productos";

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

function rowToTicket(row: Record<string, unknown>): ReservaTicketProducto {
  return {
    id: row.id as string,
    empresaId: row.empresa_id as string,
    numeroSecuencial: (row.numero_secuencial as number) ?? 0,
    nombre: row.nombre as string,
    descripcion: (row.descripcion as string | null) ?? null,
    precio: Number(row.precio),
    iva: Number(row.iva),
    modoPrecio: row.modo_precio as TicketModoPrecio,
    comentarios: (row.comentarios as string | null) ?? null,
    stockModo: row.stock_modo as TicketStockModo,
    stockTotal: (row.stock_total as number | null) ?? null,
    stockConsumido: (row.stock_consumido as number) ?? 0,
    ocultarAlAgotar: (row.ocultar_al_agotar as boolean) ?? true,
    activo: (row.activo as boolean) ?? true,
    orden: (row.orden as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function inputToRow(input: Partial<ReservaTicketProductoInput>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.nombre !== undefined) db.nombre = input.nombre.trim();
  if (input.descripcion !== undefined) db.descripcion = input.descripcion;
  if (input.precio !== undefined) db.precio = input.precio;
  if (input.iva !== undefined) db.iva = input.iva;
  if (input.modoPrecio !== undefined) db.modo_precio = input.modoPrecio;
  if (input.comentarios !== undefined) db.comentarios = input.comentarios;
  if (input.stockModo !== undefined) db.stock_modo = input.stockModo;
  if (input.stockTotal !== undefined) {
    db.stock_total = input.stockModo === "ilimitado" ? null : input.stockTotal;
  }
  if (input.stockModo === "ilimitado") db.stock_total = null;
  if (input.ocultarAlAgotar !== undefined) db.ocultar_al_agotar = input.ocultarAlAgotar;
  if (input.activo !== undefined) db.activo = input.activo;
  if (input.orden !== undefined) db.orden = input.orden;
  return db;
}

const REVALIDATE_PATH = "/sala/reservas/config";

export async function listTicketProductos() {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as ReservaTicketProducto[], error: "Sin empresa" };
    const { data, error } = await supabase
      .from("reserva_ticket_productos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("numero_secuencial", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToTicket) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[ticket-productos] list:", msg);
    return { ok: false, data: [] as ReservaTicketProducto[], error: msg };
  }
}

export async function createTicketProducto(input: ReservaTicketProductoInput) {
  try {
    const v = validarTicketInput(input);
    if (!v.ok) return { ok: false, error: v.error };
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const row = inputToRow(input);
    row.empresa_id = empresaId;
    if (input.stockModo === "ilimitado") row.stock_total = null;
    const { data, error } = await supabase
      .from("reserva_ticket_productos")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true, data: rowToTicket(data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[ticket-productos] create:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateTicketProducto(id: string, updates: Partial<ReservaTicketProductoInput>) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    if (updates.nombre !== undefined || updates.precio !== undefined || updates.iva !== undefined || updates.stockModo !== undefined || updates.stockTotal !== undefined) {
      const current = await supabase
        .from("reserva_ticket_productos")
        .select("nombre,precio,iva,modo_precio,stock_modo,stock_total")
        .eq("id", id)
        .single();
      if (current.error) throw current.error;
      const merged: ReservaTicketProductoInput = {
        nombre: updates.nombre ?? (current.data.nombre as string),
        precio: updates.precio ?? Number(current.data.precio),
        iva: updates.iva ?? Number(current.data.iva),
        modoPrecio: updates.modoPrecio ?? (current.data.modo_precio as TicketModoPrecio),
        stockModo: updates.stockModo ?? (current.data.stock_modo as TicketStockModo),
        stockTotal: updates.stockTotal !== undefined ? updates.stockTotal : (current.data.stock_total as number | null),
      };
      const v = validarTicketInput(merged);
      if (!v.ok) return { ok: false, error: v.error };
    }

    const row = inputToRow(updates);
    const { error } = await supabase
      .from("reserva_ticket_productos")
      .update(row)
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[ticket-productos] update:", msg);
    return { ok: false, error: msg };
  }
}

export async function archiveTicketProducto(id: string) {
  return updateTicketProducto(id, { activo: false });
}

export async function unarchiveTicketProducto(id: string) {
  return updateTicketProducto(id, { activo: true });
}

export async function deleteTicketProducto(id: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const used = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("ticket_producto_id", id)
      .limit(1);
    if (used.error) throw used.error;
    if ((used.count ?? 0) > 0) {
      return { ok: false, error: "Este producto ya tiene reservas asociadas. Archívalo en vez de eliminarlo." };
    }

    const { error } = await supabase
      .from("reserva_ticket_productos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[ticket-productos] delete:", msg);
    return { ok: false, error: msg };
  }
}

export async function reorderTicketProductos(orderedIds: string[]) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const updates = orderedIds.map((id, idx) =>
      supabase
        .from("reserva_ticket_productos")
        .update({ orden: idx })
        .eq("id", id)
        .eq("empresa_id", empresaId),
    );
    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error);
    if (firstError?.error) throw firstError.error;
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[ticket-productos] reorder:", msg);
    return { ok: false, error: msg };
  }
}
