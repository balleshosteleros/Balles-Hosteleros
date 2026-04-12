"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  let nombre: string | null = null;
  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("nombre, apellidos")
      .eq("user_id", userId)
      .single();
    if (data) nombre = data.nombre + " " + data.apellidos;
  }
  return {
    supabase,
    user: userId ? { id: userId } : null,
    empresaId,
    nombre,
  };
}

export async function listPedidos() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("pedidos")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[pedidos] listPedidos:", err);
    return { ok: false, data: [] };
  }
}

export async function getPedido(id: string) {
  try {
    const { supabase } = await getContext();
    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", id)
      .single();
    if (pedidoErr) throw pedidoErr;

    const { data: lineas, error: lineasErr } = await supabase
      .from("lineas_pedido")
      .select("*")
      .eq("pedido_id", id)
      .order("orden", { ascending: true });
    if (lineasErr) throw lineasErr;

    return { ok: true, data: { ...pedido, lineas: lineas ?? [] } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pedidos] getPedido:", msg);
    return { ok: false, error: msg };
  }
}

export async function createPedido(input: {
  proveedorId?: string;
  proveedorNombre: string;
  fechaEntrega?: string;
  notas?: string;
  lineas: {
    productoNombre: string;
    cantidad: number;
    unidad?: string;
    precioUnitario: number;
  }[];
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Calculate total from lineas
    const lineasConTotal = input.lineas.map((l, i) => ({
      producto_nombre: l.productoNombre,
      cantidad: l.cantidad,
      unidad: l.unidad ?? "ud",
      precio_unitario: l.precioUnitario,
      total: Math.round(l.cantidad * l.precioUnitario * 100) / 100,
      orden: i,
    }));
    const total = lineasConTotal.reduce((sum, l) => sum + l.total, 0);

    // Insert pedido
    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .insert({
        empresa_id: empresaId,
        proveedor_id: input.proveedorId ?? null,
        proveedor_nombre: input.proveedorNombre,
        fecha: new Date().toISOString().split("T")[0],
        fecha_entrega: input.fechaEntrega ?? null,
        notas: input.notas ?? null,
        total,
        created_by: user?.id ?? null,
      })
      .select()
      .single();
    if (pedidoErr) throw pedidoErr;

    // Insert lineas
    if (lineasConTotal.length > 0) {
      const lineasInsert = lineasConTotal.map((l) => ({
        ...l,
        pedido_id: pedido.id,
      }));
      const { error: lineasErr } = await supabase
        .from("lineas_pedido")
        .insert(lineasInsert);
      if (lineasErr) throw lineasErr;
    }

    return { ok: true, data: pedido };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pedidos] createPedido:", msg);
    return { ok: false, error: msg };
  }
}

export async function updatePedidoEstado(id: string, estado: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("pedidos")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pedidos] updatePedidoEstado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deletePedido(id: string) {
  try {
    const { supabase } = await getContext();
    // Lineas cascade-delete automatically via FK constraint
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pedidos] deletePedido:", msg);
    return { ok: false, error: msg };
  }
}
