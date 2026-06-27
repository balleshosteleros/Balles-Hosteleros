/**
 * Lectura admin de la carta — incluye items invisibles y descripción de empresa.
 */
import { getAppContext } from "@/lib/supabase/get-context";
import type {
  CartaCategoria,
  CartaItem,
  CartaEmpresaPublica,
  CartaAdminData,
  Alergeno,
} from "../types";

export type { CartaAdminData };

interface CategoriaRow {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  empresa_id: string;
  categoria_id: string;
  producto_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  foto_url: string | null;
  foto_storage_path: string | null;
  alergenos: string[] | null;
  orden: number;
  visible: boolean;
  destacado: boolean;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

export async function fetchCartaAdmin(): Promise<CartaAdminData> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return { empresa: null, categorias: [], items: [] };

  const [empresaRes, catRes, itemsRes] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, slug, nombre, carta_slug, carta_publicada, carta_descripcion")
      .eq("id", empresaId)
      .maybeSingle(),
    supabase
      .from("carta_categorias")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true }),
    supabase
      .from("carta_items")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true }),
  ]);

  if (catRes.error) console.error("[carta-admin] cat:", catRes.error.message);
  if (itemsRes.error) console.error("[carta-admin] items:", itemsRes.error.message);

  const empresaRow = empresaRes.data as
    | {
        id: string;
        slug: string | null;
        nombre: string;
        carta_slug: string | null;
        carta_publicada: boolean;
        carta_descripcion: string | null;
      }
    | null;

  const empresa: CartaEmpresaPublica | null = empresaRow
    ? {
        id: empresaRow.id,
        slug: empresaRow.slug ?? "",
        nombre: empresaRow.nombre,
        carta_slug: empresaRow.carta_slug ?? "",
        carta_publicada: empresaRow.carta_publicada ?? false,
        carta_descripcion: empresaRow.carta_descripcion,
      }
    : null;

  const categorias: CartaCategoria[] = ((catRes.data ?? []) as CategoriaRow[]).map((r) => ({
    id: r.id,
    empresa_id: r.empresa_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    orden: r.orden,
    visible: r.visible,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  const items: CartaItem[] = ((itemsRes.data ?? []) as ItemRow[]).map((r) => ({
    id: r.id,
    empresa_id: r.empresa_id,
    categoria_id: r.categoria_id,
    producto_id: r.producto_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    precio: typeof r.precio === "string" ? parseFloat(r.precio) : r.precio,
    foto_url: r.foto_url,
    foto_storage_path: r.foto_storage_path,
    alergenos: (r.alergenos ?? []) as Alergeno[],
    orden: r.orden,
    visible: r.visible,
    destacado: r.destacado,
    likes_count: r.likes_count,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return { empresa, categorias, items };
}
