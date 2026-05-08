"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Estado,
  Presentacion,
  PresentacionConSlides,
  Slide,
} from "../types/presentaciones";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const { data } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .single();
  return { supabase, user, empresaId: data?.empresa_id ?? null };
}

/* ─── READ ─── */

export async function listPresentaciones(filtros?: {
  estado?: Estado | "todas";
  search?: string;
}): Promise<{ ok: boolean; data: Presentacion[] }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };

    let q = supabase
      .from("presentaciones")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (filtros?.estado && filtros.estado !== "todas") q = q.eq("estado", filtros.estado);
    if (filtros?.search) q = q.ilike("titulo", `%${filtros.search}%`);

    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, data: (data ?? []) as Presentacion[] };
  } catch (err) {
    console.error("[presentaciones] list:", err);
    return { ok: false, data: [] };
  }
}

export async function getPresentacion(
  id: string,
): Promise<{ ok: boolean; data?: PresentacionConSlides; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: pres, error: pErr } = await supabase
      .from("presentaciones")
      .select("*")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();
    if (pErr) throw pErr;

    const { data: slides, error: sErr } = await supabase
      .from("presentacion_slides")
      .select("*")
      .eq("presentacion_id", id)
      .order("orden", { ascending: true });
    if (sErr) throw sErr;

    return {
      ok: true,
      data: { ...(pres as Presentacion), slides: (slides ?? []) as Slide[] },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] get:", msg);
    return { ok: false, error: msg };
  }
}

/* ─── UPDATE ─── */

export async function renombrarPresentacion(
  id: string,
  titulo: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("presentaciones").update({ titulo, nombre: titulo }).eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] renombrar:", msg);
    return { ok: false, error: msg };
  }
}

export async function archivarPresentacion(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("presentaciones")
      .update({ estado: "archivada" })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] archivar:", msg);
    return { ok: false, error: msg };
  }
}

export async function eliminarPresentacion(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("presentaciones").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] eliminar:", msg);
    return { ok: false, error: msg };
  }
}

/* ─── SLIDES ─── */

export async function actualizarSlide(
  slideId: string,
  input: Partial<Pick<Slide, "titulo" | "contenido" | "notas" | "layout">>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("presentacion_slides")
      .update(input)
      .eq("id", slideId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] actualizarSlide:", msg);
    return { ok: false, error: msg };
  }
}

export async function reordenarSlides(
  presentacionId: string,
  ordenIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getContext();
    // Estrategia: poner órdenes temporales negativos para evitar conflicto unique,
    // luego asignar los finales.
    for (let i = 0; i < ordenIds.length; i++) {
      const { error } = await supabase
        .from("presentacion_slides")
        .update({ orden: -(i + 1) })
        .eq("id", ordenIds[i])
        .eq("presentacion_id", presentacionId);
      if (error) throw error;
    }
    for (let i = 0; i < ordenIds.length; i++) {
      const { error } = await supabase
        .from("presentacion_slides")
        .update({ orden: i + 1 })
        .eq("id", ordenIds[i])
        .eq("presentacion_id", presentacionId);
      if (error) throw error;
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[presentaciones] reordenarSlides:", msg);
    return { ok: false, error: msg };
  }
}
