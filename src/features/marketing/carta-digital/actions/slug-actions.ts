"use server";

/**
 * Server actions para gestión del slug público y publicación de la carta.
 */
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { normalizarSlug, validarSlugFormato } from "../services/slug-validator";
import type { SlugValidationResult } from "../types";

export async function setSlugEmpresa(slugInput: string): Promise<SlugValidationResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa asignada al usuario." };

    const normalizado = normalizarSlug(slugInput);
    const formato = validarSlugFormato(normalizado);
    if (!formato.ok) return formato;

    const { data: existente, error: selErr } = await supabase
      .from("empresas")
      .select("id")
      .eq("carta_slug", normalizado)
      .neq("id", empresaId)
      .maybeSingle();

    if (selErr) {
      console.error("[slug-actions] check error:", selErr.message);
      return { ok: false, error: "Error verificando slug." };
    }
    if (existente) return { ok: false, error: "Ese nombre ya está en uso por otro restaurante." };

    const { error: updErr } = await supabase
      .from("empresas")
      .update({ carta_slug: normalizado })
      .eq("id", empresaId);

    if (updErr) {
      console.error("[slug-actions] update:", updErr.message);
      return { ok: false, error: "No se pudo guardar el slug." };
    }

    revalidatePath("/marketing/carta-digital");
    revalidatePath(`/carta/${normalizado}`);
    return { ok: true, slug: normalizado };
  } catch (err) {
    console.error("[slug-actions] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function togglePublicarCarta(publicar: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: empresa } = await supabase
      .from("empresas")
      .select("carta_slug")
      .eq("id", empresaId)
      .maybeSingle();

    const slug = (empresa as { carta_slug: string | null } | null)?.carta_slug;
    if (publicar && !slug) {
      return { ok: false, error: "Define un slug antes de publicar." };
    }

    const { error } = await supabase
      .from("empresas")
      .update({ carta_publicada: publicar })
      .eq("id", empresaId);

    if (error) {
      console.error("[slug-actions] publicar:", error.message);
      return { ok: false, error: "No se pudo cambiar el estado." };
    }

    revalidatePath("/marketing/carta-digital");
    if (slug) revalidatePath(`/carta/${slug}`);
    return { ok: true };
  } catch (err) {
    console.error("[slug-actions] publicar fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function actualizarDescripcionCarta(descripcion: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };
    const limpio = descripcion.trim().slice(0, 500);
    const { error } = await supabase
      .from("empresas")
      .update({ carta_descripcion: limpio })
      .eq("id", empresaId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/marketing/carta-digital");
    return { ok: true };
  } catch (err) {
    console.error("[slug-actions] descripcion:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
