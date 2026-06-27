"use server";

import { getAppContext } from "@/lib/supabase/get-context";

export async function listElaboraciones() {
  try {
    const { supabase, empresaId } = await getAppContext();
    const query = supabase
      .from("elaboraciones")
      .select("*, productos!elaboraciones_producto_elaboracion_id_fkey(id, nombre, unidad:medida)")
      .order("fecha", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[elaboraciones] listElaboraciones:", err);
    return { ok: false, data: [] };
  }
}

export async function listProductosElaboracion() {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, unidad:medida, categoria, conservacion")
      .eq("empresa_id", empresaId)
      .eq("tipo", "elaboracion")
      .eq("estado", "Activo")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[elaboraciones] listProductosElaboracion:", err);
    return { ok: false, data: [] };
  }
}

export async function createElaboracion(input: {
  productoElaboracionId: string;
  cantidadProducida: number;
  unidad: string;
  fecha: string;
  fechaCaducidad?: string | null;
  almacen: "COCINA" | "BARRA";
  descripcion?: string;
  responsable?: string;
}) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Nombre derivado del producto
    const { data: prod } = await supabase
      .from("productos")
      .select("nombre")
      .eq("id", input.productoElaboracionId)
      .single();

    const { data, error } = await supabase
      .from("elaboraciones")
      .insert({
        empresa_id: empresaId,
        nombre: prod?.nombre ?? "Elaboración",
        producto_elaboracion_id: input.productoElaboracionId,
        cantidad_producida: input.cantidadProducida,
        unidad: input.unidad,
        fecha: input.fecha,
        fecha_caducidad: input.fechaCaducidad ?? null,
        almacen: input.almacen,
        responsable: input.responsable ?? userId ?? null,
        descripcion: input.descripcion ?? null,
        estado: "borrador",
      })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] createElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateElaboracion(
  id: string,
  input: {
    productoElaboracionId?: string;
    cantidadProducida?: number;
    unidad?: string;
    fecha?: string;
    fechaCaducidad?: string | null;
    almacen?: "COCINA" | "BARRA";
    descripcion?: string;
    estado?: string;
  }
) {
  try {
    const { supabase } = await getAppContext();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.productoElaboracionId !== undefined) payload.producto_elaboracion_id = input.productoElaboracionId;
    if (input.cantidadProducida !== undefined) payload.cantidad_producida = input.cantidadProducida;
    if (input.unidad !== undefined) payload.unidad = input.unidad;
    if (input.fecha !== undefined) payload.fecha = input.fecha;
    if (input.fechaCaducidad !== undefined) payload.fecha_caducidad = input.fechaCaducidad;
    if (input.almacen !== undefined) payload.almacen = input.almacen;
    if (input.descripcion !== undefined) payload.descripcion = input.descripcion;
    if (input.estado !== undefined) payload.estado = input.estado;

    const { error } = await supabase
      .from("elaboraciones")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] updateElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function confirmarElaboracion(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.rpc("confirmar_elaboracion", { p_elab_id: id });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] confirmarElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function revertirElaboracion(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase.rpc("revertir_elaboracion", { p_elab_id: id });
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] revertirElaboracion:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteElaboracion(id: string) {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("elaboraciones")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[elaboraciones] deleteElaboracion:", msg);
    return { ok: false, error: msg };
  }
}
