"use server";

import { revalidatePath } from "next/cache";
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import type { TipoProducto } from "@/features/logistica/data/productos";

export type CategoriaProductoRow = {
  id: string;
  empresa_id: string;
  tipo: TipoProducto;
  nombre: string;
  orden: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export async function listCategoriasProducto(tipo: TipoProducto) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) {
      return { ok: false as const, data: [] as CategoriaProductoRow[], error: "Sin empresa activa" };
    }
    const { data, error } = await supabase
      .from("categorias_producto")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("tipo", tipo)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as CategoriaProductoRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-producto] list:", msg);
    return { ok: false as const, data: [] as CategoriaProductoRow[], error: msg };
  }
}

export async function createCategoriaProducto(input: {
  tipo: TipoProducto;
  nombre: string;
  orden?: number;
}) {
  try {
    const { supabase, empresaId, userId } = await getLogisticaContext();
    if (!userId || !empresaId) return { ok: false as const, error: "No autenticado" };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };

    const { data: maxRow } = await supabase
      .from("categorias_producto")
      .select("orden")
      .eq("empresa_id", empresaId)
      .eq("tipo", input.tipo)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = input.orden ?? ((maxRow?.orden ?? 0) + 1);

    const { data, error } = await supabase
      .from("categorias_producto")
      .insert({
        empresa_id: empresaId,
        tipo: input.tipo,
        nombre,
        orden: nextOrden,
        activa: true,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, error: `Ya existe la categoría "${nombre}".` };
      }
      throw error;
    }
    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as CategoriaProductoRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-producto] create:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function updateCategoriaProducto(
  id: string,
  patch: Partial<{ nombre: string; orden: number; activa: boolean }>,
) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.nombre !== undefined) updates.nombre = patch.nombre.trim();
    if (patch.orden !== undefined) updates.orden = patch.orden;
    if (patch.activa !== undefined) updates.activa = patch.activa;

    // Leer estado previo para propagar rename a productos.
    const { data: before } = await supabase
      .from("categorias_producto")
      .select("nombre, tipo")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("categorias_producto")
      .update(updates)
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false as const, error: "Ya existe una categoría con ese nombre." };
      }
      throw error;
    }

    // Si renombró, propagar el nuevo nombre a los productos que la usan
    // (mantiene la consistencia entre el catálogo y los registros vivos).
    if (
      before?.nombre &&
      before?.tipo &&
      patch.nombre !== undefined &&
      patch.nombre.trim() &&
      patch.nombre.trim() !== before.nombre
    ) {
      await supabase
        .from("productos")
        .update({ categoria: patch.nombre.trim() })
        .eq("empresa_id", empresaId)
        .eq("tipo", before.tipo as TipoProducto)
        .eq("categoria", before.nombre as string);
    }

    revalidatePath("/logistica/productos");
    return { ok: true as const, data: data as CategoriaProductoRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-producto] update:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function deleteCategoriaProducto(id: string) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const { data: cat } = await supabase
      .from("categorias_producto")
      .select("nombre, tipo")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (cat?.nombre && cat?.tipo) {
      const { count } = await supabase
        .from("productos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("tipo", cat.tipo as TipoProducto)
        .eq("categoria", cat.nombre as string);
      if ((count ?? 0) > 0) {
        return {
          ok: false as const,
          error: `No se puede borrar: ${count} producto(s) usan la categoría "${cat.nombre}". Reasígnalos primero.`,
        };
      }
    }

    const { error } = await supabase
      .from("categorias_producto")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/logistica/productos");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-producto] delete:", msg);
    return { ok: false as const, error: msg };
  }
}
