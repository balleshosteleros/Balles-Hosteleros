"use server";

/**
 * Server actions para CRUD de categorías e items de la carta digital.
 */
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { ALERGENOS_UE, type Alergeno } from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function getEmpresaSlug(supabase: { from: (t: string) => unknown }, empresaId: string) {
  const res = await (
    supabase.from("empresas") as unknown as {
      select: (s: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { carta_slug: string | null } | null }>;
        };
      };
    }
  )
    .select("carta_slug")
    .eq("id", empresaId)
    .maybeSingle();
  return res.data?.carta_slug ?? null;
}

function revalidar(slug: string | null) {
  revalidatePath("/marketing/carta-digital");
  if (slug) revalidatePath(`/carta/${slug}`);
}

// ─── CATEGORÍAS ──────────────────────────────────────────────

export async function crearCategoria(input: {
  nombre: string;
  descripcion?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

    const { data: max } = await supabase
      .from("carta_categorias")
      .select("orden")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orden = ((max as { orden: number } | null)?.orden ?? -1) + 1;

    const { data, error } = await supabase
      .from("carta_categorias")
      .insert({
        empresa_id: empresaId,
        nombre,
        descripcion: input.descripcion?.trim() || null,
        orden,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[carta][crearCategoria]", error.message);
      return { ok: false, error: "No se pudo crear la categoría." };
    }

    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true, data: { id: (data as { id: string }).id } };
  } catch (err) {
    console.error("[carta][crearCategoria] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function actualizarCategoria(input: {
  id: string;
  nombre?: string;
  descripcion?: string | null;
  visible?: boolean;
  orden?: number;
}): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const patch: Record<string, unknown> = {};
    if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
    if (input.descripcion !== undefined)
      patch.descripcion = input.descripcion?.toString().trim() || null;
    if (input.visible !== undefined) patch.visible = input.visible;
    if (input.orden !== undefined) patch.orden = input.orden;

    const { error } = await supabase
      .from("carta_categorias")
      .update(patch)
      .eq("id", input.id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[carta][actualizarCategoria]", error.message);
      return { ok: false, error: "No se pudo actualizar." };
    }
    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true };
  } catch (err) {
    console.error("[carta][actualizarCategoria] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function borrarCategoria(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    const { error } = await supabase
      .from("carta_categorias")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) {
      console.error("[carta][borrarCategoria]", error.message);
      return { ok: false, error: "No se pudo borrar." };
    }
    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true };
  } catch (err) {
    console.error("[carta][borrarCategoria] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function reordenarCategorias(orden: { id: string; orden: number }[]): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    for (const item of orden) {
      await supabase
        .from("carta_categorias")
        .update({ orden: item.orden })
        .eq("id", item.id)
        .eq("empresa_id", empresaId);
    }
    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true };
  } catch (err) {
    console.error("[carta][reordenarCategorias] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

// ─── ITEMS (PLATOS) ──────────────────────────────────────────

function sanitizarAlergenos(input: unknown): Alergeno[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<Alergeno>();
  for (const v of input) {
    if (typeof v === "string" && (ALERGENOS_UE as readonly string[]).includes(v)) {
      set.add(v as Alergeno);
    }
  }
  return Array.from(set);
}

export async function crearItem(input: {
  categoriaId: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  alergenos?: string[];
  fotoUrl?: string;
  fotoStoragePath?: string;
  productoId?: string;
  destacado?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    if (!input.categoriaId) return { ok: false, error: "Categoría obligatoria." };

    const { data: max } = await supabase
      .from("carta_items")
      .select("orden")
      .eq("categoria_id", input.categoriaId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orden = ((max as { orden: number } | null)?.orden ?? -1) + 1;

    const { data, error } = await supabase
      .from("carta_items")
      .insert({
        empresa_id: empresaId,
        categoria_id: input.categoriaId,
        producto_id: input.productoId ?? null,
        nombre,
        descripcion: input.descripcion?.trim() || null,
        precio: Number.isFinite(input.precio) ? input.precio : 0,
        foto_url: input.fotoUrl ?? null,
        foto_storage_path: input.fotoStoragePath ?? null,
        alergenos: sanitizarAlergenos(input.alergenos),
        orden,
        destacado: input.destacado ?? false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[carta][crearItem]", error.message);
      return { ok: false, error: "No se pudo crear el plato." };
    }
    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true, data: { id: (data as { id: string }).id } };
  } catch (err) {
    console.error("[carta][crearItem] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function actualizarItem(input: {
  id: string;
  categoriaId?: string;
  nombre?: string;
  descripcion?: string | null;
  precio?: number;
  alergenos?: string[];
  fotoUrl?: string | null;
  fotoStoragePath?: string | null;
  productoId?: string | null;
  visible?: boolean;
  destacado?: boolean;
  orden?: number;
}): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const patch: Record<string, unknown> = {};
    if (input.categoriaId !== undefined) patch.categoria_id = input.categoriaId;
    if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
    if (input.descripcion !== undefined)
      patch.descripcion = input.descripcion?.toString().trim() || null;
    if (input.precio !== undefined) patch.precio = Number.isFinite(input.precio) ? input.precio : 0;
    if (input.alergenos !== undefined) patch.alergenos = sanitizarAlergenos(input.alergenos);
    if (input.fotoUrl !== undefined) patch.foto_url = input.fotoUrl;
    if (input.fotoStoragePath !== undefined) patch.foto_storage_path = input.fotoStoragePath;
    if (input.productoId !== undefined) patch.producto_id = input.productoId;
    if (input.visible !== undefined) patch.visible = input.visible;
    if (input.destacado !== undefined) patch.destacado = input.destacado;
    if (input.orden !== undefined) patch.orden = input.orden;

    const { error } = await supabase
      .from("carta_items")
      .update(patch)
      .eq("id", input.id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[carta][actualizarItem]", error.message);
      return { ok: false, error: "No se pudo actualizar el plato." };
    }
    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true };
  } catch (err) {
    console.error("[carta][actualizarItem] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function borrarItem(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: item } = await supabase
      .from("carta_items")
      .select("foto_storage_path")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const storagePath = (item as { foto_storage_path: string | null } | null)?.foto_storage_path;

    const { error } = await supabase
      .from("carta_items")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) {
      console.error("[carta][borrarItem]", error.message);
      return { ok: false, error: "No se pudo borrar el plato." };
    }
    if (storagePath) {
      const { error: stErr } = await supabase.storage.from("carta-fotos").remove([storagePath]);
      if (stErr) console.warn("[carta][borrarItem] storage:", stErr.message);
    }
    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true };
  } catch (err) {
    console.error("[carta][borrarItem] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function reordenarItems(orden: { id: string; orden: number }[]): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    for (const item of orden) {
      await supabase
        .from("carta_items")
        .update({ orden: item.orden })
        .eq("id", item.id)
        .eq("empresa_id", empresaId);
    }
    revalidar(await getEmpresaSlug(supabase as never, empresaId));
    return { ok: true };
  } catch (err) {
    console.error("[carta][reordenarItems] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
