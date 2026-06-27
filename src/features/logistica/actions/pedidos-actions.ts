"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

async function getContext() {
  const { supabase, userId, empresaId } = await getLogisticaContext();
  let nombre: string | null = null;
  if (userId) {
    const { data } = await supabase
      .from("usuarios")
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
    let query = supabase
      .from("pedidos")
      .select("*")
      .order("fecha", { ascending: false });
    if (empresaId) query = query.eq("empresa_id", empresaId);
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

    // Email real + reparto vigente del proveedor (el negociado con nosotros tiene
    // prioridad; si está vacío, cae al genérico que oferta el proveedor).
    let proveedor_email: string | null = null;
    let proveedor_reparto: { dias: string[]; horario: Record<string, string>; principal: string | null } | null = null;
    if (pedido.proveedor_id) {
      const { data: prov } = await supabase
        .from("proveedores")
        .select("email_pedidos, email_principal, dias_reparto, horario_reparto, dias_reparto_negociados, horario_reparto_negociado, dia_reparto_principal")
        .eq("id", pedido.proveedor_id)
        .single();
      proveedor_email = (prov?.email_pedidos?.trim() || prov?.email_principal?.trim() || null);
      const diasNeg = (prov?.dias_reparto_negociados as string[] | null) ?? [];
      const dias = diasNeg.length > 0 ? diasNeg : ((prov?.dias_reparto as string[] | null) ?? []);
      const horario = (diasNeg.length > 0
        ? (prov?.horario_reparto_negociado as Record<string, string> | null)
        : (prov?.horario_reparto as Record<string, string> | null)) ?? {};
      proveedor_reparto = { dias, horario, principal: (prov?.dia_reparto_principal as string | null) ?? null };
    }

    return { ok: true, data: { ...pedido, lineas: lineas ?? [], proveedor_email, proveedor_reparto } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[pedidos] getPedido:", msg);
    return { ok: false, error: msg };
  }
}

export async function createPedido(input: {
  proveedorId?: string;
  proveedorNombre: string;
  numero?: string;
  fechaEntrega?: string;
  horaEntrega?: string;
  horaEntregaHasta?: string;
  notas?: string;
  lineas: {
    productoId: string;
    productoNombre: string;
    cantidad: number;
    unidad?: string;
    precioUnitario: number;
  }[];
}) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Validar que todos los productoId existen en la BD
    const productoIds = input.lineas.map((l) => l.productoId);
    const { data: productosExistentes, error: checkErr } = await supabase
      .from("productos")
      .select("id")
      .in("id", productoIds);
    if (checkErr) throw checkErr;
    const idsEncontrados = new Set((productosExistentes ?? []).map((p: { id: string }) => p.id));
    const noExisten = productoIds.filter((id) => !idsEncontrados.has(id));
    if (noExisten.length > 0) {
      return { ok: false, error: `Los siguientes productos no existen en el catálogo: ${noExisten.join(", ")}` };
    }

    // Calculate total from lineas
    const lineasConTotal = input.lineas.map((l, i) => ({
      producto_id: l.productoId,
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
        numero: input.numero ?? null,
        fecha: new Date().toISOString().split("T")[0],
        fecha_entrega: input.fechaEntrega ?? null,
        hora_entrega: input.horaEntrega ?? null,
        hora_entrega_hasta: input.horaEntregaHasta ?? null,
        notas: input.notas ?? "",
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
    const msg =
      err instanceof Error ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : JSON.stringify(err) ?? "Error desconocido";
    console.error("[pedidos] createPedido:", msg, err);
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
