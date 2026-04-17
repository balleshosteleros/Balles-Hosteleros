"use server";

/**
 * Server actions CRUD para páginas web (PRP-029 — Fase 2).
 * Protocolo MEMORY.md: try/catch + logs en toda escritura.
 */
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import type { PaginaWeb, PaginaWebTipo, PaginaWebEstado } from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function revalidar() {
  revalidatePath("/marketing/pagina-web");
}

export async function listarPaginas(): Promise<ActionResult<PaginaWeb[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("paginas_web")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[pagina-web][listarPaginas]", error.message);
      return { ok: false, error: "No se pudieron cargar las páginas." };
    }
    return { ok: true, data: (data ?? []) as PaginaWeb[] };
  } catch (err) {
    console.error("[pagina-web][listarPaginas] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function obtenerPagina(id: string): Promise<ActionResult<PaginaWeb>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("paginas_web")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (error) {
      console.error("[pagina-web][obtenerPagina]", error.message);
      return { ok: false, error: "No se pudo cargar la página." };
    }
    if (!data) return { ok: false, error: "Página no encontrada." };
    return { ok: true, data: data as PaginaWeb };
  } catch (err) {
    console.error("[pagina-web][obtenerPagina] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function crearPagina(input: {
  nombre: string;
  tipo: PaginaWebTipo;
  slugInterno?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    if (input.tipo !== "WEB_PRINCIPAL" && input.tipo !== "ONE_PAGE") {
      return { ok: false, error: "Tipo de página inválido." };
    }

    const baseSlug = slugify(input.slugInterno?.trim() || nombre);
    if (!baseSlug) return { ok: false, error: "Nombre/slug inválido (sin caracteres útiles)." };

    // Si ya existe ese slug en la empresa → sufijo numérico
    let slug = baseSlug;
    let n = 1;
    while (n < 50) {
      const { data: existente } = await supabase
        .from("paginas_web")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("slug_interno", slug)
        .maybeSingle();
      if (!existente) break;
      n += 1;
      slug = `${baseSlug}-${n}`;
    }

    const { data, error } = await supabase
      .from("paginas_web")
      .insert({
        empresa_id: empresaId,
        tipo: input.tipo,
        nombre,
        slug_interno: slug,
        bloques: [],
        estado: "BORRADOR",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[pagina-web][crearPagina]", error.message);
      return { ok: false, error: "No se pudo crear la página." };
    }

    revalidar();
    return { ok: true, data: { id: (data as { id: string }).id } };
  } catch (err) {
    console.error("[pagina-web][crearPagina] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function renombrarPagina(input: {
  id: string;
  nombre: string;
}): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "Nombre obligatorio." };

    const { error } = await supabase
      .from("paginas_web")
      .update({ nombre })
      .eq("id", input.id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[pagina-web][renombrarPagina]", error.message);
      return { ok: false, error: "No se pudo renombrar." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[pagina-web][renombrarPagina] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function cambiarEstadoPagina(input: {
  id: string;
  estado: PaginaWebEstado;
}): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const patch: Record<string, unknown> = { estado: input.estado };
    if (input.estado === "PUBLICADA") patch.publicada_at = new Date().toISOString();

    const { error } = await supabase
      .from("paginas_web")
      .update(patch)
      .eq("id", input.id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[pagina-web][cambiarEstado]", error.message);
      return { ok: false, error: "No se pudo actualizar el estado." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[pagina-web][cambiarEstado] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function borrarPagina(id: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { error } = await supabase
      .from("paginas_web")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[pagina-web][borrarPagina]", error.message);
      return { ok: false, error: "No se pudo borrar." };
    }
    revalidar();
    return { ok: true };
  } catch (err) {
    console.error("[pagina-web][borrarPagina] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
