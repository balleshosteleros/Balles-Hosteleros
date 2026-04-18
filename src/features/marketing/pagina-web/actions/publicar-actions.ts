"use server";

/**
 * Publicación / despublicación + listado y restauración de versiones.
 * El snapshot a paginas_web_versiones lo dispara el trigger trg_paginas_web_snapshot.
 */
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import type { PaginaWebVersion } from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export async function publicarPagina(paginaId: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    // Requisito: al menos un dominio verificado
    const { data: dom } = await supabase
      .from("paginas_web_dominios")
      .select("id", { count: "exact", head: false })
      .eq("pagina_id", paginaId)
      .eq("empresa_id", empresaId)
      .eq("estado", "VERIFICADO")
      .limit(1);

    if (!dom || (Array.isArray(dom) && dom.length === 0)) {
      return {
        ok: false,
        error: "Necesitas al menos un dominio verificado antes de publicar.",
      };
    }

    const { error } = await supabase
      .from("paginas_web")
      .update({ estado: "PUBLICADA", publicada_at: new Date().toISOString() })
      .eq("id", paginaId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[publicar] update:", error.message);
      return { ok: false, error: "No se pudo publicar." };
    }

    revalidatePath(`/marketing/pagina-web/${paginaId}`);
    revalidatePath("/marketing/pagina-web");
    return { ok: true };
  } catch (err) {
    console.error("[publicar] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function despublicarPagina(paginaId: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { error } = await supabase
      .from("paginas_web")
      .update({ estado: "BORRADOR" })
      .eq("id", paginaId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[despublicar]", error.message);
      return { ok: false, error: "No se pudo despublicar." };
    }

    revalidatePath(`/marketing/pagina-web/${paginaId}`);
    revalidatePath("/marketing/pagina-web");
    return { ok: true };
  } catch (err) {
    console.error("[despublicar] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function listarVersiones(paginaId: string): Promise<ActionResult<PaginaWebVersion[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data, error } = await supabase
      .from("paginas_web_versiones")
      .select("*")
      .eq("pagina_id", paginaId)
      .order("version", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[versiones] list:", error.message);
      return { ok: false, error: "No se pudieron cargar las versiones." };
    }
    return { ok: true, data: (data ?? []) as PaginaWebVersion[] };
  } catch (err) {
    console.error("[versiones] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function restaurarVersion(input: {
  paginaId: string;
  versionId: string;
}): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: ver, error: vErr } = await supabase
      .from("paginas_web_versiones")
      .select("snapshot, pagina_id")
      .eq("id", input.versionId)
      .maybeSingle();
    if (vErr || !ver) return { ok: false, error: "Versión no encontrada." };

    const snapshot = (ver as { snapshot: { bloques: unknown; seo: unknown; branding: unknown } }).snapshot;

    const { error } = await supabase
      .from("paginas_web")
      .update({
        bloques: snapshot.bloques,
        seo: snapshot.seo,
        branding: snapshot.branding,
      })
      .eq("id", input.paginaId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[restaurar] update:", error.message);
      return { ok: false, error: "No se pudo restaurar." };
    }

    revalidatePath(`/marketing/pagina-web/${input.paginaId}`);
    return { ok: true };
  } catch (err) {
    console.error("[restaurar] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
