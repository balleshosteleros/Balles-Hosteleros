"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { ActionResult, Compra } from "../types";

export async function listCompras(recetaId: string): Promise<ActionResult<Compra[]>> {
  try {
    const { supabase } = await getAppContext();
    const { data, error } = await supabase
      .from("nueva_receta_compra")
      .select("*")
      .eq("receta_id", recetaId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data as Compra[]) ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function upsertCompra(input: {
  id?: string;
  receta_id: string;
  proveedor_id?: string | null;
  proveedor_nombre_libre?: string | null;
  producto_id?: string | null;
  producto_nombre_propuesto?: string | null;
  cantidad?: number | null;
  unidad?: string;
  precio_propuesto?: number | null;
  fecha_recepcion_prevista?: string | null;
  notas?: string | null;
}): Promise<ActionResult<Compra>> {
  try {
    const { supabase } = await getAppContext();
    const payload = {
      receta_id: input.receta_id,
      proveedor_id: input.proveedor_id ?? null,
      proveedor_nombre_libre: input.proveedor_nombre_libre ?? null,
      producto_id: input.producto_id ?? null,
      producto_nombre_propuesto: input.producto_nombre_propuesto ?? null,
      cantidad: input.cantidad ?? null,
      unidad: input.unidad ?? "kg",
      precio_propuesto: input.precio_propuesto ?? null,
      fecha_recepcion_prevista: input.fecha_recepcion_prevista ?? null,
      notas: input.notas ?? null,
    };
    const { data, error } = input.id
      ? await supabase
          .from("nueva_receta_compra")
          .update(payload)
          .eq("id", input.id)
          .select()
          .single()
      : await supabase
          .from("nueva_receta_compra")
          .insert(payload)
          .select()
          .single();
    if (error) throw error;
    return { ok: true, data: data as Compra };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function deleteCompra(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getAppContext();
    const { error } = await supabase
      .from("nueva_receta_compra")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// Helpers de lectura para selectores (proveedores + productos)
export async function listProveedoresEmpresa(): Promise<ActionResult<Array<{ id: string; nombre_comercial: string }>>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("proveedores")
      .select("id, nombre_comercial")
      .eq("empresa_id", empresaId)
      .eq("estado", "Activo")
      .order("nombre_comercial", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data as Array<{ id: string; nombre_comercial: string }>) ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export interface ProductoCompraSimple {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;              // unidad de compra (ej: "caja")
  unidad_uso: string | null;   // unidad en escandallos (ej: "L", "kg")
  factor_conversion: number;   // unidad_compra × factor = unidad_uso
}

export async function listProductosCompra(): Promise<ActionResult<ProductoCompraSimple[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: true, data: [] };
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, categoria, unidad:medida, unidad_uso, factor_conversion")
      .eq("empresa_id", empresaId)
      .eq("tipo", "Compra")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true, data: (data as ProductoCompraSimple[]) ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
