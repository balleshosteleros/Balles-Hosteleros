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

export async function createAlbaran(input: {
  numero: string;
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
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("albaranes")
      .insert({
        empresa_id: empresaId,
        numero: input.numero,
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
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id as string };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[albaranes] createAlbaran:", msg);
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
