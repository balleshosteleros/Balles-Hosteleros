"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";

const BUCKET = "cronogramas-videos";

export async function uploadCronogramaVideo(
  cronogramaId: string,
  fileName: string,
  fileBase64: string,
  mime: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const supabase = await createServerClient();
    const safeName = fileName.replace(/[^\w.-]+/g, "_");
    const path = `${cronogramaId}/${Date.now()}_${safeName}`;
    const buffer = Buffer.from(fileBase64, "base64");

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: true });
    if (error) return { ok: false, error: error.message };

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = data.publicUrl;

    const { error: updErr } = await supabase
      .from("cronogramas_operativos")
      .update({ video_url: url })
      .eq("id", cronogramaId);
    if (updErr) return { ok: false, error: updErr.message };

    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteCronogramaVideo(cronogramaId: string, url: string) {
  try {
    const supabase = await createServerClient();
    const idx = url.indexOf(`/${BUCKET}/`);
    if (idx >= 0) {
      const objectPath = url.slice(idx + BUCKET.length + 2);
      await supabase.storage.from(BUCKET).remove([objectPath]);
    }
    await supabase.from("cronogramas_operativos").update({ video_url: null }).eq("id", cronogramaId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function updateCronogramaResumen(id: string, resumen: string) {
  try {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("cronogramas_operativos")
      .update({ resumen })
      .eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error" };
  }
}
