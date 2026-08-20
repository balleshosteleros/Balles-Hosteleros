/**
 * Generador de las dos actas del ciclo de vida de una entrega de material:
 *
 *   - ENTREGA:    el trabajador reconoce que ha recibido la pieza.
 *   - DEVOLUCIÓN: el trabajador y la empresa dejan constancia de que la ha devuelto.
 *
 * Son el mismo documento con distinto verbo, así que comparten generador: cambia
 * el título, el párrafo del cuerpo y —solo en la entrega— la advertencia de que
 * hay que devolverlo al salir.
 *
 * Cada acta cubre UNA sola pieza: una entrega es una unidad, sin cantidades. Eso
 * es lo que permite que el acta de devolución sea inequívoca (se devuelve esto,
 * no "2 de 3 camisetas").
 *
 * Una hoja A4 con los datos del trabajador, la pieza y una zona de firma. El acta
 * eIDAS (audit trail) se concatena automáticamente al firmar.
 */

import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ActaEntregaVariante = "entrega" | "devolucion";

export interface ActaEntregaInput {
  variante: ActaEntregaVariante;
  empleadoNombre: string;
  empleadoDni: string | null;
  empresaNombre: string;
  empresaCif: string | null;
  ciudad: string | null;
  /** dd/mm/yyyy — fecha de la entrega, o de la solicitud de devolución. */
  fecha: string;
  /** Qué pieza es: "Camiseta", "Llaves del local"… */
  tipoNombre: string;
  categoria: "uniforme" | "material";
  talla: string | null;
  /** Solo informa en el acta de ENTREGA: hay que devolverlo al salir. */
  requiereDevolucion: boolean;
  nota: string | null;
}

/** Dónde estampar la firma manuscrita, calculado por el propio generador. */
export interface PosicionFirmaDefault {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
  /** Alto del hueco reservado, para que el trazo lo llene sin desbordarlo. */
  altoPct: number;
}

export interface ActaEntregaResult {
  buffer: Buffer;
  posicionFirma: PosicionFirmaDefault;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 64;
const FONT_SIZE = 11;
const LINE_HEIGHT = 17;
const TEXT_W = PAGE_W - MARGIN_X * 2;

type Seg = { t: string; bold?: boolean };

/** Título del documento, también usado como `titulo` de la firma. */
export function tituloActa(variante: ActaEntregaVariante, tipoNombre: string): string {
  return variante === "entrega"
    ? `Entrega de ${tipoNombre}`
    : `Devolución de ${tipoNombre}`;
}

export async function generarActaEntregaPDF(
  input: ActaEntregaInput,
): Promise<ActaEntregaResult> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const widthOf = (t: string, bold: boolean) =>
    (bold ? fontBold : font).widthOfTextAtSize(t, FONT_SIZE);

  let y = PAGE_H - 90;

  // Párrafo con segmentos normal/negrita y salto de línea automático.
  function drawParagraph(segs: Seg[], gapAfter = LINE_HEIGHT) {
    const words: Seg[] = [];
    for (const s of segs) {
      for (const p of s.t.split(/(\s+)/)) {
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
      if (esEspacio && x === MARGIN_X) continue;
      page.drawText(w.t, { x, y, size: FONT_SIZE, font: w.bold ? fontBold : font });
      x += wWidth;
    }
    y -= gapAfter;
  }

  const esEntrega = input.variante === "entrega";

  // ─── Título ───────────────────────────────────────────────────
  const titulo = esEntrega
    ? "ACTA DE ENTREGA DE MATERIAL"
    : "ACTA DE DEVOLUCIÓN DE MATERIAL";
  page.drawText(titulo, { x: MARGIN_X, y, size: 15, font: fontBold });
  y -= LINE_HEIGHT * 2;

  // ─── Ciudad y fecha, a la derecha ─────────────────────────────
  const ciudadFecha = `${input.ciudad ?? "—"}, a ${input.fecha}`;
  page.drawText(ciudadFecha, {
    x: MARGIN_X + TEXT_W - widthOf(ciudadFecha, false),
    y,
    size: FONT_SIZE,
    font,
  });
  y -= LINE_HEIGHT * 2.5;

  // ─── Cuerpo ───────────────────────────────────────────────────
  const empresaConCif = input.empresaCif
    ? `${input.empresaNombre} (CIF ${input.empresaCif})`
    : input.empresaNombre;

  if (esEntrega) {
    drawParagraph([
      { t: "Yo, " },
      { t: input.empleadoNombre, bold: true },
      { t: input.empleadoDni ? ` (con DNI/NIE ${input.empleadoDni})` : "" },
      { t: ", declaro haber " },
      { t: "recibido de", bold: true },
      { t: ` ${empresaConCif} el material que se detalla a continuación, en buen estado y para su uso durante mi relación laboral.` },
    ], LINE_HEIGHT * 2);
  } else {
    drawParagraph([
      { t: "Yo, " },
      { t: input.empleadoNombre, bold: true },
      { t: input.empleadoDni ? ` (con DNI/NIE ${input.empleadoDni})` : "" },
      { t: ", declaro haber " },
      { t: "devuelto a", bold: true },
      { t: ` ${empresaConCif} el material que se detalla a continuación, quedando saldada mi responsabilidad sobre el mismo.` },
    ], LINE_HEIGHT * 2);
  }

  // ─── La pieza ─────────────────────────────────────────────────
  const etiquetaCategoria = input.categoria === "uniforme" ? "Uniforme" : "Material";
  drawParagraph([{ t: "Detalle:", bold: true }], LINE_HEIGHT);
  drawParagraph([
    { t: "· " },
    { t: input.tipoNombre, bold: true },
    { t: input.talla ? ` — talla ${input.talla}` : "" },
    { t: ` (${etiquetaCategoria})` },
  ], LINE_HEIGHT * 2);

  if (input.nota) {
    drawParagraph([
      { t: "Observaciones: ", bold: true },
      { t: input.nota },
    ], LINE_HEIGHT * 2);
  }

  // Solo en la entrega: el compromiso de devolverlo.
  if (esEntrega && input.requiereDevolucion) {
    drawParagraph([
      {
        t: "Me comprometo a devolver este material a la finalización de mi relación laboral, o cuando la empresa me lo requiera, en el estado en que lo he recibido salvo el desgaste propio de su uso.",
        bold: true,
      },
    ], LINE_HEIGHT * 2);
  }

  // ─── Firma del trabajador ─────────────────────────────────────
  page.drawText("Firma del trabajador:", { x: MARGIN_X, y, size: FONT_SIZE, font: fontBold });
  y -= LINE_HEIGHT;

  // Hueco del trazo manuscrito. Se mide aquí para calcular la posición de firma
  // sin ajustar coordenadas a ojo: el estampador espera porcentajes con origen
  // ARRIBA-izquierda, de ahí la conversión de yPct.
  const FIRMA_ALTO = 66;
  const FIRMA_ANCHO_PCT = 0.32;
  y -= 6;
  const firmaTopY = y;
  const posicionFirma: PosicionFirmaDefault = {
    pagina: 1,
    xPct: MARGIN_X / PAGE_W,
    yPct: (PAGE_H - firmaTopY) / PAGE_H,
    anchoPct: FIRMA_ANCHO_PCT,
    altoPct: FIRMA_ALTO / PAGE_H,
  };

  y -= FIRMA_ALTO;
  page.drawText(input.empleadoNombre, { x: MARGIN_X, y, size: FONT_SIZE, font });
  if (input.empleadoDni) {
    y -= LINE_HEIGHT;
    page.drawText(`DNI/NIE: ${input.empleadoDni}`, { x: MARGIN_X, y, size: FONT_SIZE, font });
  }

  // ─── Footer ───────────────────────────────────────────────────
  page.drawText(
    "Documento generado electrónicamente — la firma eIDAS adjunta acredita su validez.",
    { x: MARGIN_X, y: 48, size: 8, font, color: rgb(0.55, 0.6, 0.66) },
  );

  const bytes = await pdf.save();
  return { buffer: Buffer.from(bytes), posicionFirma };
}
