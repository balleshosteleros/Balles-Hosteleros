"use server";

import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";

export type CategoriaProveedorRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  orden: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
};

export async function listCategoriasProveedor() {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, data: [] as CategoriaProveedorRow[], error: "Sin empresa activa" };
    const { data, error } = await supabase
      .from("categorias_proveedor")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) throw error;
    return { ok: true as const, data: (data ?? []) as CategoriaProveedorRow[] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-proveedor] list:", msg);
    return { ok: false as const, data: [] as CategoriaProveedorRow[], error: msg };
  }
}

export async function createCategoriaProveedor(input: { nombre: string; orden?: number }) {
  try {
    const { supabase, empresaId, userId } = await getLogisticaContext();
    if (!userId || !empresaId) return { ok: false as const, error: "No autenticado" };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false as const, error: "El nombre es obligatorio" };

    const { data: maxRow } = await supabase
      .from("categorias_proveedor")
      .select("orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrden = input.orden ?? ((maxRow?.orden ?? 0) + 1);

    const { data, error } = await supabase
      .from("categorias_proveedor")
      .insert({ empresa_id: empresaId, nombre, orden: nextOrden, activa: true })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: `Ya existe la categoría "${nombre}".` };
      throw error;
    }
    return { ok: true as const, data: data as CategoriaProveedorRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-proveedor] create:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function updateCategoriaProveedor(
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

    const { data: before } = await supabase
      .from("categorias_proveedor")
      .select("nombre")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("categorias_proveedor")
      .update(updates)
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Ya existe una categoría con ese nombre." };
      throw error;
    }

    if (before?.nombre && patch.nombre !== undefined && patch.nombre.trim() && patch.nombre.trim() !== before.nombre) {
      await supabase
        .from("proveedores")
        .update({ categoria: patch.nombre.trim() })
        .eq("empresa_id", empresaId)
        .eq("categoria", before.nombre as string);
    }

    return { ok: true as const, data: data as CategoriaProveedorRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-proveedor] update:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function deleteCategoriaProveedor(id: string) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const { data: cat } = await supabase
      .from("categorias_proveedor")
      .select("nombre")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (cat?.nombre) {
      const { count } = await supabase
        .from("proveedores")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("categoria", cat.nombre as string);
      if ((count ?? 0) > 0) {
        return {
          ok: false as const,
          error: `No se puede borrar: ${count} proveedor(es) usan "${cat.nombre}".`,
        };
      }
    }

    const { error } = await supabase
      .from("categorias_proveedor")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[categorias-proveedor] delete:", msg);
    return { ok: false as const, error: msg };
  }
}

// ── Configuración global de proveedores (operativa de compra) ──

export type ProveedoresConfig = {
  mostrar_solo_productos_proveedor: boolean;
  avisar_doc_existente: boolean;
  ocultar_precios_compra_impresion: boolean;
};

const DEFAULT_PROVEEDORES_CONFIG: ProveedoresConfig = {
  mostrar_solo_productos_proveedor: true,
  avisar_doc_existente: true,
  ocultar_precios_compra_impresion: false,
};

export async function getProveedoresConfig() {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: true as const, data: DEFAULT_PROVEEDORES_CONFIG };
    const { data, error } = await supabase
      .from("proveedores_config")
      .select("mostrar_solo_productos_proveedor, avisar_doc_existente, ocultar_precios_compra_impresion")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    return { ok: true as const, data: (data ?? DEFAULT_PROVEEDORES_CONFIG) as ProveedoresConfig };
  } catch (err) {
    console.error("[proveedores-config] get:", err);
    return { ok: false as const, data: DEFAULT_PROVEEDORES_CONFIG };
  }
}

export async function saveProveedoresConfig(config: ProveedoresConfig) {
  try {
    const { supabase, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };
    const { error } = await supabase
      .from("proveedores_config")
      .upsert({
        empresa_id: empresaId,
        ...config,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[proveedores-config] save:", msg);
    return { ok: false as const, error: msg };
  }
}
