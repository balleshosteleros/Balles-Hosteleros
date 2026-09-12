/**
 * Lectura admin de la carta — incluye items invisibles y descripción de empresa.
 */
import { getAppContext } from "@/lib/supabase/get-context";
import { apagadoVigente, HORAS_APAGADO_DEFAULT } from "@/features/cocina/apagados/lib/caducidad";
import { getHorasApagado } from "@/features/cocina/apagados/lib/horas-apagado-server";
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
  familia: string | null;
  destacada: boolean | null;
  dias_semana: number[] | null;
  hora_desde: string | null;
  hora_hasta: string | null;
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
  likes_base: number | null;
  agotado_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchCartaAdmin(): Promise<CartaAdminData> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId)
    return { empresa: null, categorias: [], items: [], horasApagado: HORAS_APAGADO_DEFAULT };

  // "Agotado" caduca solo, pasadas las horas configuradas en Comandas.
  const horasApagado = await getHorasApagado(supabase, empresaId);

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
      familia: (r.familia as CartaCategoria["familia"]) ?? null,
    destacada: r.destacada ?? false,
    dias_semana: r.dias_semana,
    hora_desde: r.hora_desde,
    hora_hasta: r.hora_hasta,
}));

  // Nombre real de los productos vinculados, en una sola consulta.
  const productoIds = Array.from(
    new Set(((itemsRes.data ?? []) as ItemRow[]).map((r) => r.producto_id).filter((v): v is string => !!v)),
  );
  const nombresProducto = new Map<string, string>();
  // El agotado de un plato vinculado vive en su PRODUCTO (lo apaga cocina y
  // así llega también al TPV); solo los platos escritos a mano lo llevan
  // propio. El panel tiene que reflejar los dos.
  const agotadosProducto = new Set<string>();
  if (productoIds.length > 0) {
    const { data: prods } = await supabase
      .from("productos")
      .select("id, nombre, agotado_at")
      .in("id", productoIds);
    for (const pr of (prods ?? []) as Array<{ id: string; nombre: string; agotado_at: string | null }>) {
      nombresProducto.set(pr.id, pr.nombre);
      if (apagadoVigente(pr.agotado_at, horasApagado)) agotadosProducto.add(pr.id);
    }
  }

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
    likes_base: r.likes_base ?? 0,
    agotado:
      apagadoVigente(r.agotado_at, horasApagado) ||
      (!!r.producto_id && agotadosProducto.has(r.producto_id)),
    producto_nombre: r.producto_id ? nombresProducto.get(r.producto_id) ?? null : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return { empresa, categorias, items, horasApagado };
}
