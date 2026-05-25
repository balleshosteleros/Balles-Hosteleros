"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "empresa-logos";

type LogoVariant = "principal" | "alt" | "isotipo";

function variantPrefix(variant: LogoVariant): string {
  if (variant === "alt") return "logo_alt";
  if (variant === "isotipo") return "isotipo";
  return "logo";
}

function variantColumn(variant: LogoVariant): "logo_url" | "logo_alt_url" | "isotipo_url" {
  if (variant === "alt") return "logo_alt_url";
  if (variant === "isotipo") return "isotipo_url";
  return "logo_url";
}

async function removeFromStorage(supabase: ReturnType<typeof createAdminClient>, publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const pathInBucket = url.pathname.split(`/object/public/${BUCKET}/`)[1];
    if (pathInBucket) await supabase.storage.from(BUCKET).remove([pathInBucket]);
  } catch {
    /* noop */
  }
}

async function uploadVariant(empresaSlug: string, formData: FormData, variant: LogoVariant): Promise<string> {
  const supabase = createAdminClient();
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No se recibió ningún archivo.");

  const ext = file.name.split(".").pop() ?? "png";
  const path = `${empresaSlug}/${variantPrefix(variant)}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(`Error al subir logo: ${uploadError.message}`);

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Espejo en empresa_logos (clave por slug) — solo para la variante principal,
  // que es la que ya consumen otras superficies legacy del sistema.
  if (variant === "principal") {
    const { error: dbError } = await supabase
      .from("empresa_logos")
      .upsert({ empresa_slug: empresaSlug, logo_url: publicUrl, updated_at: new Date().toISOString() });
    if (dbError) throw new Error(`Error al guardar URL: ${dbError.message}`);
  }

  // Fuente de verdad: empresas.{logo_url|logo_alt_url}
  const { error: empresasErr } = await supabase
    .from("empresas")
    .update({ [variantColumn(variant)]: publicUrl })
    .eq("slug", empresaSlug);
  if (empresasErr) throw new Error(`Error al guardar URL en empresas: ${empresasErr.message}`);

  return publicUrl;
}

async function deleteVariant(empresaSlug: string, variant: LogoVariant): Promise<void> {
  const supabase = createAdminClient();
  const column = variantColumn(variant);

  const { data: empresaRow } = await supabase
    .from("empresas")
    .select(column)
    .eq("slug", empresaSlug)
    .maybeSingle();

  await removeFromStorage(supabase, (empresaRow as Record<string, string | null> | null)?.[column]);

  if (variant === "principal") {
    await supabase
      .from("empresa_logos")
      .upsert({ empresa_slug: empresaSlug, logo_url: "", updated_at: new Date().toISOString() });
  }

  await supabase
    .from("empresas")
    .update({ [column]: null })
    .eq("slug", empresaSlug);
}

/** Sube un archivo de logo a Supabase Storage y guarda la URL pública en empresas + empresa_logos. */
export async function uploadLogo(empresaSlug: string, formData: FormData): Promise<string> {
  return uploadVariant(empresaSlug, formData, "principal");
}

/** Elimina el logo principal de Storage y limpia URLs en empresas + empresa_logos. */
export async function deleteLogo(empresaSlug: string): Promise<void> {
  return deleteVariant(empresaSlug, "principal");
}

/** Sube logo alternativo (ej. fondo oscuro) — solo persiste en empresas.logo_alt_url. */
export async function uploadLogoAlt(empresaSlug: string, formData: FormData): Promise<string> {
  return uploadVariant(empresaSlug, formData, "alt");
}

/** Elimina logo alternativo de Storage y limpia empresas.logo_alt_url. */
export async function deleteLogoAlt(empresaSlug: string): Promise<void> {
  return deleteVariant(empresaSlug, "alt");
}

/** Sube el isotipo (solo icono, sin texto) y lo guarda en empresas.isotipo_url. */
export async function uploadIsotipo(empresaSlug: string, formData: FormData): Promise<string> {
  return uploadVariant(empresaSlug, formData, "isotipo");
}

/** Elimina el isotipo de Storage y limpia empresas.isotipo_url. */
export async function deleteIsotipo(empresaSlug: string): Promise<void> {
  return deleteVariant(empresaSlug, "isotipo");
}

/** Devuelve un mapa slug → logo_url de todas las empresas (lectura admin). */
export async function getLogoUrls(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("empresas").select("slug, logo_url");
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.logo_url) result[row.slug] = row.logo_url;
  }
  return result;
}

/** Devuelve un mapa slug → isotipo_url de todas las empresas. */
export async function getIsotipoUrls(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("empresas").select("slug, isotipo_url");
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.isotipo_url) result[row.slug] = row.isotipo_url;
  }
  return result;
}

/** Guarda el color primario en empresas.color (compat con flujo existente). */
export async function saveEmpresaColor(empresaSlug: string, color: string): Promise<void> {
  const supabase = createAdminClient();
  const { error: empresasErr } = await supabase
    .from("empresas")
    .update({ color })
    .eq("slug", empresaSlug);
  if (empresasErr) throw new Error(`Error al guardar color: ${empresasErr.message}`);

  // Mirror legacy en empresa_logos por compat.
  await supabase
    .from("empresa_logos")
    .upsert({ empresa_slug: empresaSlug, color_primario: color, updated_at: new Date().toISOString() });
}

/** Devuelve un mapa slug → color de todas las empresas. */
export async function getEmpresaColors(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("empresas").select("slug, color");
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.color) result[row.slug] = row.color;
  }
  return result;
}

export type EstiloCards = "plana" | "sombra" | "borde";
export type ModoCarta = "claro" | "oscuro" | "auto";

export interface BrandConfig {
  logoUrl: string | null;
  logoAltUrl: string | null;
  isotipoUrl: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  colorTexto: string | null;
  fuenteTitulos: string | null;
  fuenteCuerpo: string | null;
  cartaColorFondo: string | null;
  cartaColorAcento: string | null;
  cartaFuenteTitulos: string | null;
  cartaFuenteCuerpo: string | null;
  cartaHeroUrl: string | null;
  cartaEstiloCards: EstiloCards | null;
  cartaModo: ModoCarta | null;
}

/** Lee la configuración de marca completa (logo + paleta + tema carta) por slug. */
export async function getBrandConfig(empresaSlug: string): Promise<BrandConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("empresas")
    .select(
      "logo_url, logo_alt_url, isotipo_url, color, color_secundario, color_texto, fuente_titulos, fuente_cuerpo, carta_color_fondo, carta_color_acento, carta_fuente_titulos, carta_fuente_cuerpo, carta_hero_url, carta_estilo_cards, carta_modo",
    )
    .eq("slug", empresaSlug)
    .maybeSingle();
  if (error) {
    console.error("[brand] getBrandConfig:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    logoUrl: (data.logo_url as string | null) ?? null,
    logoAltUrl: (data.logo_alt_url as string | null) ?? null,
    isotipoUrl: (data.isotipo_url as string | null) ?? null,
    colorPrimario: (data.color as string | null) ?? null,
    colorSecundario: (data.color_secundario as string | null) ?? null,
    colorTexto: (data.color_texto as string | null) ?? null,
    fuenteTitulos: (data.fuente_titulos as string | null) ?? null,
    fuenteCuerpo: (data.fuente_cuerpo as string | null) ?? null,
    cartaColorFondo: (data.carta_color_fondo as string | null) ?? null,
    cartaColorAcento: (data.carta_color_acento as string | null) ?? null,
    cartaFuenteTitulos: (data.carta_fuente_titulos as string | null) ?? null,
    cartaFuenteCuerpo: (data.carta_fuente_cuerpo as string | null) ?? null,
    cartaHeroUrl: (data.carta_hero_url as string | null) ?? null,
    cartaEstiloCards: (data.carta_estilo_cards as EstiloCards | null) ?? null,
    cartaModo: (data.carta_modo as ModoCarta | null) ?? null,
  };
}

export interface BrandConfigUpdate {
  primario?: string | null;
  secundario?: string | null;
  texto?: string | null;
  fuenteTitulos?: string | null;
  fuenteCuerpo?: string | null;
  cartaColorFondo?: string | null;
  cartaColorAcento?: string | null;
  cartaFuenteTitulos?: string | null;
  cartaFuenteCuerpo?: string | null;
  cartaEstiloCards?: EstiloCards | null;
  cartaModo?: ModoCarta | null;
}

/** Guarda toda la configuracion de marca (paleta + tema carta) en empresas. */
export async function saveBrandColors(empresaSlug: string, cfg: BrandConfigUpdate): Promise<void> {
  const supabase = createAdminClient();
  const updates: Record<string, string | null> = {};
  if (cfg.primario !== undefined) updates.color = cfg.primario;
  if (cfg.secundario !== undefined) updates.color_secundario = cfg.secundario;
  if (cfg.texto !== undefined) updates.color_texto = cfg.texto;
  if (cfg.fuenteTitulos !== undefined) updates.fuente_titulos = cfg.fuenteTitulos;
  if (cfg.fuenteCuerpo !== undefined) updates.fuente_cuerpo = cfg.fuenteCuerpo;
  if (cfg.cartaColorFondo !== undefined) updates.carta_color_fondo = cfg.cartaColorFondo;
  if (cfg.cartaColorAcento !== undefined) updates.carta_color_acento = cfg.cartaColorAcento;
  if (cfg.cartaFuenteTitulos !== undefined) updates.carta_fuente_titulos = cfg.cartaFuenteTitulos;
  if (cfg.cartaFuenteCuerpo !== undefined) updates.carta_fuente_cuerpo = cfg.cartaFuenteCuerpo;
  if (cfg.cartaEstiloCards !== undefined) updates.carta_estilo_cards = cfg.cartaEstiloCards;
  if (cfg.cartaModo !== undefined) updates.carta_modo = cfg.cartaModo;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from("empresas").update(updates).eq("slug", empresaSlug);
  if (error) throw new Error(`Error al guardar configuracion de marca: ${error.message}`);

  if (updates.color !== undefined) {
    await supabase
      .from("empresa_logos")
      .upsert({ empresa_slug: empresaSlug, color_primario: updates.color, updated_at: new Date().toISOString() });
  }
}

/** Sube imagen de hero/banner de la carta a Storage y guarda URL en empresas. */
export async function uploadCartaHero(empresaSlug: string, formData: FormData): Promise<string> {
  const supabase = createAdminClient();
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No se recibió ningún archivo.");

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${empresaSlug}/carta_hero_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(`Error al subir hero: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("empresas").update({ carta_hero_url: publicUrl }).eq("slug", empresaSlug);
  if (error) throw new Error(`Error al guardar URL de hero: ${error.message}`);

  return publicUrl;
}

/** Elimina el hero de la carta y limpia URL. */
export async function deleteCartaHero(empresaSlug: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("empresas")
    .select("carta_hero_url")
    .eq("slug", empresaSlug)
    .maybeSingle();

  await removeFromStorage(supabase, (row as { carta_hero_url?: string | null } | null)?.carta_hero_url);

  await supabase.from("empresas").update({ carta_hero_url: null }).eq("slug", empresaSlug);
}
