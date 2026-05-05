/**
 * Lectura pública de la carta por slug (cliente anon).
 * Usado por el server component /carta/[slug]/page.tsx.
 * RLS exige `carta_publicada=true` y `visible=true`.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type {
  CartaPublica,
  CartaCategoria,
  CartaItem,
  CartaEmpresaPublica,
  EstiloCards,
  ModoCarta,
  Alergeno,
} from "../types";

/**
 * Cliente service-role usado SÓLO para leer la fila de `empresas` por slug.
 * `empresas` tiene RLS que bloquea anon; en lugar de exponer la tabla completa
 * con una policy `to anon`, usamos el server component (esto se ejecuta server-side)
 * para leer los 4 campos públicos y devolver al cliente solo lo necesario.
 * Nunca expuesto al navegador.
 */
function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface EmpresaRow {
  id: string;
  nombre: string;
  carta_slug: string;
  carta_publicada: boolean;
  carta_horarios: unknown;
  carta_descripcion: string | null;
  logo_url: string | null;
  logo_alt_url: string | null;
  color: string | null;
  color_secundario: string | null;
  color_texto: string | null;
  carta_color_fondo: string | null;
  carta_color_acento: string | null;
  carta_fuente_titulos: string | null;
  carta_fuente_cuerpo: string | null;
  carta_hero_url: string | null;
  carta_estilo_cards: string | null;
  carta_modo: string | null;
}

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

function rowToCategoria(r: CategoriaRow): CartaCategoria {
  return {
    id: r.id,
    empresa_id: r.empresa_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    orden: r.orden,
    visible: r.visible,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function rowToItem(r: ItemRow): CartaItem {
  return {
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
  };
}

export async function fetchCartaPorSlug(slug: string): Promise<CartaPublica | null> {
  try {
    // Carga inicial con service role (server-side, no llega al navegador).
    // Las RLS actuales de carta_categorias/carta_items hacen un join a empresas
    // que el cliente anon no puede leer, devolviendo [] vacío. Por eso el server
    // hace la carga completa y entrega ya renderizado al cliente.
    // (Realtime client-side de likes seguirá usando anon — ver useLikesRealtime.)
    const supabase = serviceClient();

    const { data: empresa, error: empresaErr } = await supabase
      .from("empresas")
      .select(
        "id, nombre, carta_slug, carta_publicada, carta_horarios, carta_descripcion, logo_url, logo_alt_url, color, color_secundario, color_texto, carta_color_fondo, carta_color_acento, carta_fuente_titulos, carta_fuente_cuerpo, carta_hero_url, carta_estilo_cards, carta_modo",
      )
      .eq("carta_slug", slug)
      .eq("carta_publicada", true)
      .maybeSingle<EmpresaRow>();

    if (empresaErr) {
      console.error("[carta-fetch] empresa error:", empresaErr.message);
      return null;
    }
    if (!empresa) return null;

    const empresaPub: CartaEmpresaPublica = {
      id: empresa.id,
      nombre: empresa.nombre,
      carta_slug: empresa.carta_slug,
      carta_publicada: empresa.carta_publicada,
      carta_horarios: (empresa.carta_horarios as CartaPublica["empresa"]["carta_horarios"]) ?? null,
      carta_descripcion: empresa.carta_descripcion,
      logo_url: empresa.logo_url,
      logo_alt_url: empresa.logo_alt_url,
      color_primario: empresa.color,
      color_secundario: empresa.color_secundario,
      color_texto: empresa.color_texto,
      carta_color_fondo: empresa.carta_color_fondo,
      carta_color_acento: empresa.carta_color_acento,
      carta_fuente_titulos: empresa.carta_fuente_titulos,
      carta_fuente_cuerpo: empresa.carta_fuente_cuerpo,
      carta_hero_url: empresa.carta_hero_url,
      carta_estilo_cards: (empresa.carta_estilo_cards as EstiloCards | null) ?? null,
      carta_modo: (empresa.carta_modo as ModoCarta | null) ?? null,
    };

    const [categoriasRes, itemsRes] = await Promise.all([
      supabase
        .from("carta_categorias")
        .select("*")
        .eq("empresa_id", empresa.id)
        .eq("visible", true)
        .order("orden", { ascending: true }),
      supabase
        .from("carta_items")
        .select("*")
        .eq("empresa_id", empresa.id)
        .eq("visible", true)
        .order("orden", { ascending: true }),
    ]);

    if (categoriasRes.error) console.error("[carta-fetch] cat error:", categoriasRes.error.message);
    if (itemsRes.error) console.error("[carta-fetch] items error:", itemsRes.error.message);

    const categoriasRows = (categoriasRes.data ?? []) as CategoriaRow[];
    const itemsRows = (itemsRes.data ?? []) as ItemRow[];

    const items = itemsRows.map(rowToItem);
    const categorias = categoriasRows.map(rowToCategoria).map((c) => ({
      ...c,
      items: items.filter((i) => i.categoria_id === c.id),
    }));
    const destacados = items.filter((i) => i.destacado);

    return { empresa: empresaPub, categorias, destacados };
  } catch (err) {
    console.error("[carta-fetch] fatal:", err);
    return null;
  }
}
