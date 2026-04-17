"use server";

/**
 * Lectura admin de categorías/items de carta digital para el picker del bloque menu.
 */
import { getAppContext } from "@/lib/supabase/get-context";

export interface CategoriaPickable {
  id: string;
  nombre: string;
  total_items: number;
}

export async function listarCategoriasDisponibles(): Promise<CategoriaPickable[]> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return [];
  const [catRes, itemsRes] = await Promise.all([
    supabase
      .from("carta_categorias")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .eq("visible", true)
      .order("orden", { ascending: true }),
    supabase
      .from("carta_items")
      .select("id, categoria_id")
      .eq("empresa_id", empresaId)
      .eq("visible", true),
  ]);
  if (catRes.error) {
    console.error("[pagina-web][listarCategorias]", catRes.error.message);
    return [];
  }
  const conteo = new Map<string, number>();
  for (const row of (itemsRes.data ?? []) as { categoria_id: string }[]) {
    conteo.set(row.categoria_id, (conteo.get(row.categoria_id) ?? 0) + 1);
  }
  return ((catRes.data ?? []) as Array<{ id: string; nombre: string }>).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    total_items: conteo.get(c.id) ?? 0,
  }));
}
