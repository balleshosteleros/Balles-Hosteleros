"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  return { supabase, user: userId ? { id: userId } : null, empresaId };
}

export async function listAlbaranes() {
  try {
    const { supabase, empresaId } = await getContext();
    let query = supabase
      .from("albaranes")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[albaranes] listAlbaranes:", err);
    return { ok: false, data: [] };
  }
}

type CreateAlbaranResult =
  | { ok: true; id: string; numero: string; numeroSecuencial: number }
  | { ok: false; error: string };

export async function createAlbaran(input: {
  pedidoId: string;
  proveedorNombre: string;
  almacen: string;
  documento: string;
  fecha: string;
  dtoPct: number;
  dtoEur: number;
  notas: string;
  creador: string;
  lineas: unknown[];
  /** Si viene del pedido, se copia para que albarán y pedido compartan numeración. */
  numeroSecuencial?: number;
  /** Número que pone el proveedor en su albarán (opcional, lo extrae OCR o se edita manualmente). */
  numeroProveedor?: string | null;
}): Promise<CreateAlbaranResult> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const year = new Date(input.fecha || new Date().toISOString()).getFullYear();
    const insertPayload: Record<string, unknown> = {
      empresa_id: empresaId,
      pedido_id: input.pedidoId,
      proveedor_nombre: input.proveedorNombre,
      almacen: input.almacen,
      documento: input.documento,
      fecha: input.fecha,
      estado: "Pendiente",
      dto_pct: input.dtoPct,
      dto_eur: input.dtoEur,
      notas: input.notas,
      creador: input.creador,
      lineas: input.lineas,
      numero_proveedor: input.numeroProveedor ?? null,
    };

    if (typeof input.numeroSecuencial === "number") {
      insertPayload.numero_secuencial = input.numeroSecuencial;
      insertPayload.numero = `ALB-${year}-${String(input.numeroSecuencial).padStart(3, "0")}`;
    } else {
      // Sin pedido de origen: el trigger asigna numero_secuencial; numero se compone luego.
      insertPayload.numero = "";
    }

    const { data, error } = await supabase
      .from("albaranes")
      .insert(insertPayload)
      .select("id, numero, numero_secuencial")
      .single();
    if (error) throw error;

    // Si el numero quedó vacío (caso huérfano), lo actualizamos con el secuencial asignado.
    if (!data.numero && typeof data.numero_secuencial === "number") {
      const numeroFinal = `ALB-${year}-${String(data.numero_secuencial).padStart(3, "0")}`;
      await supabase.from("albaranes").update({ numero: numeroFinal }).eq("id", data.id);
      return { ok: true, id: data.id as string, numero: numeroFinal, numeroSecuencial: data.numero_secuencial };
    }

    return {
      ok: true,
      id: data.id as string,
      numero: data.numero as string,
      numeroSecuencial: data.numero_secuencial as number,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] createAlbaran:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateAlbaranNumeroProveedor(id: string, numeroProveedor: string | null) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("albaranes")
      .update({ numero_proveedor: numeroProveedor })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] updateAlbaranNumeroProveedor:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateAlbaranEstado(id: string, estado: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("albaranes")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] updateAlbaranEstado:", msg);
    return { ok: false, error: msg };
  }
}
