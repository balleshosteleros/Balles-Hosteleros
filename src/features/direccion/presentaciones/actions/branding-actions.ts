"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { Branding } from "../types/presentaciones";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export async function getBranding(): Promise<{ ok: boolean; data?: Branding; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("empresa_branding")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      // insertar default y devolver
      const { data: created, error: insErr } = await supabase
        .from("empresa_branding")
        .insert({ empresa_id: empresaId })
        .select()
        .single();
      if (insErr) throw insErr;
      return { ok: true, data: created as Branding };
    }
    return { ok: true, data: data as Branding };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[branding] getBranding:", msg);
    return { ok: false, error: msg };
  }
}

export async function saveBranding(
  input: Partial<Omit<Branding, "empresa_id" | "updated_at">>,
): Promise<{ ok: boolean; data?: Branding; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("empresa_branding")
      .upsert(
        {
          empresa_id: empresaId,
          ...input,
        },
        { onConflict: "empresa_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return { ok: true, data: data as Branding };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[branding] saveBranding:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Sube un logo al bucket `empresa-logos` y devuelve la URL pública.
 * Espera un File/Blob serializable via FormData.
 */
export async function uploadLogo(
  file: File,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const ext = file.name.split(".").pop() ?? "png";
    const path = `${empresaId}/logo-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("empresa-logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from("empresa-logos").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[branding] uploadLogo:", msg);
    return { ok: false, error: msg };
  }
}
