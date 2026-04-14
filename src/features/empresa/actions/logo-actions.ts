"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "empresa-logos";

/** Sube un archivo de logo a Supabase Storage y guarda la URL pública en empresa_logos. */
export async function uploadLogo(empresaSlug: string, formData: FormData): Promise<string> {
  const supabase = createAdminClient();
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No se recibió ningún archivo.");

  const ext = file.name.split(".").pop() ?? "png";
  // Añadir timestamp para forzar invalidación de caché del navegador
  const path = `${empresaSlug}/logo_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(`Error al subir logo: ${uploadError.message}`);

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: dbError } = await supabase
    .from("empresa_logos")
    .upsert({ empresa_slug: empresaSlug, logo_url: publicUrl, updated_at: new Date().toISOString() });

  if (dbError) throw new Error(`Error al guardar URL: ${dbError.message}`);

  return publicUrl;
}

/** Elimina el logo de Storage y borra la URL de empresa_logos. */
export async function deleteLogo(empresaSlug: string): Promise<void> {
  const supabase = createAdminClient();

  // Obtener URL actual para extraer el path en Storage
  const { data } = await supabase
    .from("empresa_logos")
    .select("logo_url")
    .eq("empresa_slug", empresaSlug)
    .single();

  if (data?.logo_url) {
    // Extraer path relativo del bucket desde la URL pública
    const url = new URL(data.logo_url);
    const pathInBucket = url.pathname.split(`/object/public/${BUCKET}/`)[1];
    if (pathInBucket) {
      await supabase.storage.from(BUCKET).remove([pathInBucket]);
    }
  }

  await supabase
    .from("empresa_logos")
    .upsert({ empresa_slug: empresaSlug, logo_url: "", updated_at: new Date().toISOString() });
}

/** Devuelve un mapa slug → logo_url de todas las empresas. */
export async function getLogoUrls(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("empresa_logos").select("empresa_slug, logo_url");
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.logo_url) result[row.empresa_slug] = row.logo_url;
  }
  return result;
}

/** Guarda el color primario de la empresa en Supabase. */
export async function saveEmpresaColor(empresaSlug: string, color: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("empresa_logos")
    .upsert({ empresa_slug: empresaSlug, color_primario: color, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Error al guardar color: ${error.message}`);
}

/** Devuelve un mapa slug → color_primario de todas las empresas. */
export async function getEmpresaColors(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("empresa_logos").select("empresa_slug, color_primario");
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.color_primario) result[row.empresa_slug] = row.color_primario;
  }
  return result;
}
