"use client";

import { getSwatches } from "colorthief";

export interface BrandPalette {
  primario: string;
  secundario: string;
  texto: string;
}

function loadCrossOriginImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen para analizar colores."));
    // Cache-buster para evitar imágenes anteriores cacheadas sin CORS.
    const cacheBuster = src.includes("?") ? "&" : "?";
    img.src = `${src}${cacheBuster}cb=${Date.now()}`;
  });
}

/**
 * Extrae paleta de marca de un logo usando ColorThief.
 * - primario: swatch Vibrant si existe, si no el primero útil.
 * - secundario: Muted o DarkVibrant.
 * - texto: blanco o negro según el contraste con primario.
 */
export async function extractBrandColorsFromUrl(logoUrl: string): Promise<BrandPalette> {
  const img = await loadCrossOriginImage(logoUrl);
  const swatches = await getSwatches(img, { colorCount: 8 });

  const primarioSwatch =
    swatches.Vibrant ??
    swatches.DarkVibrant ??
    swatches.LightVibrant ??
    swatches.Muted ??
    swatches.DarkMuted ??
    swatches.LightMuted ??
    null;

  const secundarioSwatch =
    (primarioSwatch?.role !== "Muted" ? swatches.Muted : null) ??
    (primarioSwatch?.role !== "DarkVibrant" ? swatches.DarkVibrant : null) ??
    (primarioSwatch?.role !== "LightVibrant" ? swatches.LightVibrant : null) ??
    swatches.DarkMuted ??
    swatches.LightMuted ??
    primarioSwatch;

  const primario = primarioSwatch?.color.hex() ?? "#1f2937";
  const secundario = secundarioSwatch?.color.hex() ?? primario;
  const texto = primarioSwatch?.titleTextColor.hex() ?? pickReadableTextColor(primario);

  return { primario, secundario, texto };
}

/** Decide blanco o negro según luminancia relativa del color base. */
export function pickReadableTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const value = parseInt(m[1], 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  // Luminancia perceptual aproximada (sRGB → relative luminance simplificada)
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? "#111111" : "#ffffff";
}
