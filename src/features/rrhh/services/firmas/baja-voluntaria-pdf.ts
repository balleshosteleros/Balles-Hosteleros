/**
 * Generador del PDF "Carta de baja voluntaria" que el empleado firma
 * cuando solicita una baja de contrato desde Mi Panel.
 *
 * El texto reproduce la plantilla institucional de baja voluntaria de la
 * empresa. Una sola hoja A4 con datos del empleado y empresa, fecha efectiva
 * de la baja, preaviso y una zona de "Firma del trabajador" donde se estampa
 * el trazo manuscrito. El acta eIDAS (audit trail) se concatena automáticamente
 * al firmar el documento.
 */

import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface CartaBajaVoluntariaInput {
  empleadoNombre: string;
  empleadoDni: string | null;
  empresaNombre: string;
  empresaCif: string | null;
  ciudad: string | null; // ciudad del local de fichaje (si la hay)
  fechaSolicitud: string; // dd/mm/yyyy
  fechaBaja: string; // dd/mm/yyyy
  diasPreaviso: number;
  motivo: string | null;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 64;
const FONT_SIZE = 11;
const LINE_HEIGHT = 17;
const TEXT_W = PAGE_W - MARGIN_X * 2;

/**
 * Envoltura simple de líneas segmentadas: cada segmento tiene su propia fuente
 * (normal/negrita). Devuelve las líneas ya cortadas al ancho disponible,
 * conservando qué fuente usa cada trozo para dibujarlo después.
 */
type Seg = { t: string; bold?: boolean };

/** Posición de la firma calculada por el propio generador (no "a ojo"). */
export interface PosicionFirmaDefault {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
}

export interface CartaBajaVoluntariaResult {
  buffer: Buffer;
  /** Dónde estampar la firma manuscrita: hueco reservado bajo "Firma del trabajador". */
  posicionFirma: PosicionFirmaDefault;
}

export async function generarCartaBajaVoluntariaPDF(
  input: CartaBajaVoluntariaInput,
): Promise<CartaBajaVoluntariaResult> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const widthOf = (t: string, bold: boolean) =>
    (bold ? fontBold : font).widthOfTextAtSize(t, FONT_SIZE);

  let y = PAGE_H - 90;

  // Dibuja un párrafo formado por segmentos (normal/negrita) con salto de línea
  // automático al llegar al margen derecho. Avanza `y` según las líneas usadas.
  function drawParagraph(segs: Seg[], gapAfter = LINE_HEIGHT) {
    // Expandimos a palabras conservando la fuente de cada una.
    const words: Seg[] = [];
    for (const s of segs) {
      const parts = s.t.split(/(\s+)/); // conserva los espacios como tokens
      for (const p of parts) {
        if (p.length === 0) continue;
        words.push({ t: p, bold: s.bold });
      }
    }
    let x = MARGIN_X;
    for (const w of words) {
      const wWidth = widthOf(w.t, !!w.bold);
      const esEspacio = /^\s+$/.test(w.t);
      if (x + wWidth > MARGIN_X + TEXT_W && !esEspacio) {
        x = MARGIN_X;
        y -= LINE_HEIGHT;
      }
      if (esEspacio && x === MARGIN_X) continue; // no arrastrar espacios al inicio de línea
      page.drawText(w.t, {
        x,
        y,
        size: FONT_SIZE,
        font: w.bold ? fontBold : font,
      });
      x += wWidth;
    }
    y -= gapAfter;
  }

  // ─── Encabezado: ciudad y fecha (alineado a la derecha) ───────
  const ciudadFecha = `${input.ciudad ?? "—"}, a ${input.fechaSolicitud}`;
  page.drawText(ciudadFecha, {
    x: MARGIN_X + TEXT_W - widthOf(ciudadFecha, false),
    y,
    size: FONT_SIZE,
    font,
  });
  y -= LINE_HEIGHT * 3;

  // ─── Cuerpo (reproduce la plantilla de baja voluntaria) ───────
  drawParagraph([
    { t: "Estimado/a departamento de Recursos Humanos de " },
    { t: input.empresaNombre, bold: true },
    { t: "," },
  ], LINE_HEIGHT * 2);

  drawParagraph([
    { t: "Mediante la presente, yo " },
    { t: input.empleadoNombre, bold: true },
    {
      t: input.empleadoDni ? ` (con DNI/NIE ${input.empleadoDni})` : "",
    },
    { t: ", comunico mi decisión de " },
    { t: "causar baja voluntaria en la empresa", bold: true },
    { t: ", siendo " },
    {
      t: `mi último día de trabajo el ${input.fechaBaja}`,
      bold: true,
    },
    {
      t: `, respetando un preaviso de ${input.diasPreaviso} días naturales contados desde la firma de este documento `,
    },
    {
      t: "(al día siguiente de la firma comienza el cómputo del preaviso; el día efectivo de baja es el último de prestación de servicios y supone la finalización de la relación laboral).",
      bold: true,
    },
  ], LINE_HEIGHT * 2);

  drawParagraph([
    {
      t: "Agradezco sinceramente la oportunidad de haber formado parte del equipo y me despido deseando lo mejor para la empresa y sus futuros proyectos.",
    },
  ], LINE_HEIGHT * 2);

  drawParagraph([{ t: "Atentamente," }], LINE_HEIGHT * 2);

  // ─── Motivo (opcional) ────────────────────────────────────────
  if (input.motivo) {
    drawParagraph([
      { t: "Motivo expresado por el solicitante: ", bold: true },
      { t: input.motivo },
    ], LINE_HEIGHT * 2);
  }

  // ─── Firma del trabajador ─────────────────────────────────────
  page.drawText("Firma del trabajador:", {
    x: MARGIN_X,
    y,
    size: FONT_SIZE,
    font: fontBold,
  });
  y -= LINE_HEIGHT;

  // Hueco reservado para el trazo manuscrito. Capturamos su geometría exacta
  // (en coordenadas PDF, origen abajo-izquierda) para calcular la posición de
  // firma AUTOMÁTICAMENTE, sin ajustar coordenadas a ojo. El estampador espera
  // porcentajes con origen ARRIBA-izquierda, así que convertimos yPct.
  // Hueco alto (66pt) para que el trazo no invada el nombre/DNI de debajo.
  // Debe ser >= a la altura máxima que el estampador da al trazo (ver pdf.ts).
  const FIRMA_ALTO = 66;
  const FIRMA_ANCHO_PCT = 0.32;
  y -= 6; // pequeño aire entre la etiqueta y el trazo
  const firmaTopY = y; // borde superior del hueco (justo bajo la etiqueta)
  const posicionFirma: PosicionFirmaDefault = {
    pagina: 1,
    xPct: MARGIN_X / PAGE_W,
    yPct: (PAGE_H - firmaTopY) / PAGE_H,
    anchoPct: FIRMA_ANCHO_PCT,
  };

  y -= FIRMA_ALTO;
  page.drawText(input.empleadoNombre, {
    x: MARGIN_X,
    y,
    size: FONT_SIZE,
    font,
  });
  if (input.empleadoDni) {
    y -= LINE_HEIGHT;
    page.drawText(`DNI/NIE: ${input.empleadoDni}`, {
      x: MARGIN_X,
      y,
      size: FONT_SIZE,
      font,
    });
  }

  // ─── Footer ───────────────────────────────────────────────────
  page.drawText(
    "Documento generado electrónicamente — la firma eIDAS adjunta acredita su validez.",
    {
      x: MARGIN_X,
      y: 48,
      size: 8,
      font,
      color: rgb(0.55, 0.6, 0.66),
    },
  );

  const bytes = await pdf.save();
  return { buffer: Buffer.from(bytes), posicionFirma };
}
