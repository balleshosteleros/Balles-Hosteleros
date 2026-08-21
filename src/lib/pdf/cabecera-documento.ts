/**
 * Cabecera común de TODOS los documentos que emite el software.
 *
 * Un documento que alguien firma tiene que decir de quién viene, así que todos
 * arrancan igual: el isotipo de la empresa centrado arriba del todo, el título
 * debajo, y una línea fina que separa la cabecera del cuerpo.
 *
 * El logo sale de Ajustes → Imagen de marca (`empresas.isotipo_url`, y si no hay,
 * `logo_url`): la misma fuente que usan los correos, para que el correo y el PDF
 * que lo acompaña se vean como la misma casa.
 *
 * Si el logo no se puede descargar, la cabecera cae al NOMBRE de la empresa en
 * texto. Un documento nunca se queda sin emitir por un fallo de imagen.
 */

import "server-only";
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";

/** Tinta de los títulos: gris azulado oscuro, no negro puro. */
export const TINTA = rgb(0.06, 0.09, 0.16);
/** Gris de las líneas y textos secundarios. */
export const GRIS_SUAVE = rgb(0.83, 0.85, 0.88);

/** Alto máximo del isotipo en la cabecera, en puntos PDF. */
const LOGO_ALTO_MAX = 54;
/** Ancho máximo, para que un logo apaisado no invada la hoja. */
const LOGO_ANCHO_MAX = 190;
/** Tiempo máximo esperando la imagen: el documento no se bloquea por el logo. */
const TIMEOUT_MS = 6000;

export interface MarcaEmpresa {
  nombre: string;
  isotipoUrl: string | null;
  logoUrl: string | null;
}

/** Lee la marca de la empresa. Misma fuente que los correos. */
export async function getMarcaEmpresa(empresaId: string): Promise<MarcaEmpresa | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("empresas")
      .select("nombre, isotipo_url, logo_url")
      .eq("id", empresaId)
      .maybeSingle();
    if (!data) return null;
    const d = data as { nombre: string | null; isotipo_url: string | null; logo_url: string | null };
    return {
      nombre: d.nombre ?? "",
      isotipoUrl: d.isotipo_url,
      logoUrl: d.logo_url,
    };
  } catch {
    return null;
  }
}

/** Descarga la imagen del logo. Devuelve null si falla o tarda demasiado. */
async function descargarLogo(url: string): Promise<{ bytes: Uint8Array; tipo: "png" | "jpg" } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) return null;

    // El tipo se decide por los bytes, no por la extensión de la URL: un .png
    // puede venir siendo jpeg y `embedPng` lanzaría.
    const esPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const esJpg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!esPng && !esJpg) return null;

    return { bytes: buf, tipo: esPng ? "png" : "jpg" };
  } catch {
    return null;
  }
}

export interface CabeceraInput {
  pdf: PDFDocument;
  page: PDFPage;
  /** Ancho de página, para centrar. */
  pageW: number;
  /** Alto de página, desde donde se empieza a bajar. */
  pageH: number;
  marginX: number;
  /** Título del documento en mayúsculas: "ACTA DE ENTREGA DE MATERIAL". */
  titulo: string;
  fontBold: PDFFont;
  font: PDFFont;
  marca: MarcaEmpresa | null;
}

/**
 * Pinta la cabecera y devuelve la `y` donde debe seguir el cuerpo del documento.
 * Todos los generadores arrancan llamando aquí, así que comparten aspecto sin
 * repetir el código de centrado en cada uno.
 */
export async function dibujarCabecera(input: CabeceraInput): Promise<number> {
  const { pdf, page, pageW, pageH, marginX, titulo, fontBold, font, marca } = input;

  let y = pageH - 52;

  // ─── Isotipo centrado ───────────────────────────────────────────
  const url = marca?.isotipoUrl || marca?.logoUrl || null;
  let logoPintado = false;

  if (url) {
    const img = await descargarLogo(url);
    if (img) {
      try {
        const embebida =
          img.tipo === "png" ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);

        // Escala respetando ambos topes, sin deformar la imagen.
        const escala = Math.min(
          LOGO_ALTO_MAX / embebida.height,
          LOGO_ANCHO_MAX / embebida.width,
          1,
        );
        const w = embebida.width * escala;
        const h = embebida.height * escala;

        page.drawImage(embebida, { x: (pageW - w) / 2, y: y - h, width: w, height: h });
        y -= h + 22;
        logoPintado = true;
      } catch {
        // Imagen corrupta o en un formato que pdf-lib no admite: se cae al nombre.
      }
    }
  }

  // Sin logo, la empresa se identifica por su nombre: el documento no puede
  // quedarse sin decir de quién viene.
  if (!logoPintado && marca?.nombre) {
    const size = 16;
    const w = fontBold.widthOfTextAtSize(marca.nombre, size);
    page.drawText(marca.nombre, { x: (pageW - w) / 2, y: y - size, size, font: fontBold, color: TINTA });
    y -= size + 20;
  }

  // ─── Título del documento, centrado ─────────────────────────────
  const tituloSize = 15;
  const tituloW = fontBold.widthOfTextAtSize(titulo, tituloSize);
  page.drawText(titulo, {
    x: (pageW - tituloW) / 2,
    y: y - tituloSize,
    size: tituloSize,
    font: fontBold,
    color: TINTA,
  });
  y -= tituloSize + 16;

  // ─── Línea separadora ───────────────────────────────────────────
  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageW - marginX, y },
    thickness: 0.75,
    color: GRIS_SUAVE,
  });

  // Aire antes del cuerpo. `font` se recibe para que los generadores no tengan
  // que recalcular métricas con otra fuente.
  void font;
  return y - 30;
}

/** Pie común: misma frase y mismo gris en todos los documentos. */
export function dibujarPie(page: PDFPage, marginX: number, font: PDFFont, texto?: string): void {
  page.drawText(
    texto ??
      "Documento generado electrónicamente — la firma eIDAS adjunta acredita su validez.",
    { x: marginX, y: 48, size: 8, font, color: rgb(0.55, 0.6, 0.66) },
  );
}
