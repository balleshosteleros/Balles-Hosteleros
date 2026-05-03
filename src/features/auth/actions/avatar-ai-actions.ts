"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchImageAsInput, geminiImage } from "@/lib/ia/gemini-image";
import { buildUniformePrompt, uniformeParaRol } from "@/features/auth/lib/role-uniform-prompts";

const BUCKET = "avatars";

export interface GenerateAiAvatarResult {
  ok: boolean;
  avatarAiUrl?: string;
  rolUsado?: string;
  error?: string;
}

/**
 * Genera la versión IA del avatar del usuario:
 * - Toma profile.avatar_url como base (foto real).
 * - Toma rol_label como rol (texto libre del usuario).
 * - Toma empresa_logos.logo_url (por slug) como referencia para el uniforme.
 * - Llama a Gemini 2.5 Flash Image manteniendo la cara y vistiendo según rol.
 * - Sube la imagen generada al bucket avatars y guarda en profiles.avatar_ai_url.
 *
 * No lanza excepciones — devuelve { ok: false, error } para que el cliente
 * pueda seguir mostrando la foto real si la generación falla (cuota, safety, etc).
 */
export async function generateAiAvatar(
  userId: string,
  empresaSlug: string | null,
): Promise<GenerateAiAvatarResult> {
  if (!userId) return { ok: false, error: "Usuario no identificado." };

  try {
    const supabase = createAdminClient();

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("avatar_url, rol_label")
      .eq("user_id", userId)
      .single();
    if (profileErr) {
      console.error("[generateAiAvatar] error leyendo profile:", profileErr.message);
      return { ok: false, error: "No se pudo leer el perfil." };
    }
    if (!profile?.avatar_url) {
      return { ok: false, error: "No hay foto base sobre la que generar." };
    }

    if (!empresaSlug) {
      return { ok: false, error: "No hay empresa seleccionada para esta cuenta." };
    }

    const { data: logoRow } = await supabase
      .from("empresa_logos")
      .select("logo_url")
      .eq("empresa_slug", empresaSlug)
      .maybeSingle();
    const logoUrl = logoRow?.logo_url ?? null;
    if (!logoUrl) {
      return {
        ok: false,
        error:
          "La empresa todavía no tiene logotipo configurado. Sube primero el logo en Ajustes → Empresa para que aparezca en el uniforme.",
      };
    }

    const rol = profile.rol_label as string | null;
    const { label: rolUsado } = uniformeParaRol(rol);

    let logoInput;
    try {
      logoInput = await fetchImageAsInput(logoUrl);
    } catch (e) {
      console.error("[generateAiAvatar] error descargando logo:", e);
      return { ok: false, error: "No se pudo descargar el logotipo de la empresa." };
    }

    const inputs = [await fetchImageAsInput(profile.avatar_url), logoInput];
    const prompt = buildUniformePrompt(rol, true);
    const { imageBuffer } = await geminiImage(prompt, inputs);

    const path = `${userId}/ai_${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, imageBuffer, { upsert: true, contentType: "image/png" });
    if (uploadError) {
      console.error("[generateAiAvatar] error subiendo imagen IA:", uploadError.message);
      return { ok: false, error: `Error al subir imagen IA: ${uploadError.message}` };
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_ai_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (dbError) {
      console.error("[generateAiAvatar] error guardando avatar_ai_url:", dbError.message);
      return { ok: false, error: `Error al guardar URL: ${dbError.message}` };
    }

    return { ok: true, avatarAiUrl: publicUrl, rolUsado };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido generando avatar IA";
    console.error("[generateAiAvatar] excepción:", msg);
    return { ok: false, error: msg };
  }
}
