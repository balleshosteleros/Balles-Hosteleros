/**
 * Generador del PDF "Anulación del preaviso de baja".
 *
 * Se emite cuando un trabajador que había presentado su baja vuelve al equipo:
 * durante el preaviso se habló con él y se queda. El documento deja constancia
 * de las tres fechas que importan —cuándo pidió la baja, qué día iba a ser su
 * último día, y desde cuándo queda todo sin efecto— y de que la relación laboral
 * continúa **en las mismas condiciones**, que es lo que evita discusiones luego.
 *
 * Lo firma el trabajador: sin su firma no se puede acreditar que la baja se
 * anuló de mutuo acuerdo, y por eso el sistema le impide fichar hasta que lo
 * haga (ver `anulacion-preaviso-pendiente.ts`).
 *
 * Misma mecánica que el resto de documentos que genera el sistema: el generador
 * calcula y DEVUELVE la posición exacta del hueco de firma, no se pone a ojo.
 */

import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dibujarCabecera, type MarcaEmpresa } from "@/lib/pdf/cabecera-documento";
import type { PosicionFirmaDefault } from "@/features/rrhh/services/firmas/baja-voluntaria-pdf";

export interface AnulacionPreavisoInput {
  empleadoNombre: string;
  empleadoDni: string | null;
  empresaNombre: string;
  ciudad: string | null;
  /** dd/mm/aaaa — día en que se firma la anulación. */
  fechaAnulacion: string;
  /** dd/mm/aaaa — día en que presentó la baja. */
  fechaSolicitud: string | null;
  /** dd/mm/aaaa — último día de trabajo que figuraba en el preaviso. */
  fechaBajaPrevista: string;
  /** Logo de la empresa para la cabecera (Ajustes → Imagen de marca). */
  marca?: MarcaEmpresa | null;
}

export interface AnulacionPreavisoResult {
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

export async function generarAnulacionPreavisoPDF(
  input: AnulacionPreavisoInput,
): Promise<AnulacionPreavisoResult> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const widthOf = (t: string, bold: boolean) =>
    (bold ? fontBold : font).widthOfTextAtSize(t, FONT_SIZE);

  let y = PAGE_H - 90;

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

  y = await dibujarCabecera({
    pdf,
    page,
    pageW: PAGE_W,
    pageH: PAGE_H,
    marginX: MARGIN_X,
    titulo: "ANULACIÓN DEL PREAVISO DE BAJA",
    fontBold,
    font,
    marca: input.marca ?? null,
  });

  const ciudadFecha = `${input.ciudad ?? "—"}, a ${input.fechaAnulacion}`;
  page.drawText(ciudadFecha, {
    x: MARGIN_X + TEXT_W - widthOf(ciudadFecha, false),
    y,
    size: FONT_SIZE,
    font,
  });
  y -= LINE_HEIGHT * 3;

  drawParagraph(
    [
      { t: "Yo, " },
      { t: input.empleadoNombre, bold: true },
      { t: input.empleadoDni ? ` (con DNI/NIE ${input.empleadoDni})` : "" },
      { t: ", y la empresa " },
      { t: input.empresaNombre, bold: true },
      { t: ", dejamos constancia de lo siguiente:" },
    ],
    LINE_HEIGHT * 2,
  );

  drawParagraph(
    [
      input.fechaSolicitud
        ? { t: `Con fecha ${input.fechaSolicitud} presenté mi baja voluntaria, quedando fijado como ` }
        : { t: "Presenté mi baja voluntaria, quedando fijado como " },
      { t: `último día de trabajo el ${input.fechaBajaPrevista}`, bold: true },
      { t: "." },
    ],
    LINE_HEIGHT * 2,
  );

  drawParagraph(
    [
      { t: "Con fecha " },
      { t: input.fechaAnulacion, bold: true },
      { t: ", y de común acuerdo entre ambas partes, " },
      { t: "dicho preaviso queda ANULADO y sin efecto", bold: true },
      {
        t: ". En consecuencia, la baja prevista para el " +
          `${input.fechaBajaPrevista} no llegará a producirse y `,
      },
      { t: "continúo prestando servicios en la empresa", bold: true },
      {
        t: " con normalidad, manteniéndose mi contrato y mis condiciones laborales en los mismos términos que hasta ahora, sin interrupción alguna de la relación laboral ni de mi antigüedad.",
      },
    ],
    LINE_HEIGHT * 2,
  );

  drawParagraph(
    [
      {
        t: "Y para que así conste, firmo la presente anulación de forma voluntaria.",
      },
    ],
    LINE_HEIGHT * 2,
  );

  page.drawText("Firma del trabajador:", {
    x: MARGIN_X,
    y,
    size: FONT_SIZE,
    font: fontBold,
  });
  y -= LINE_HEIGHT;

  // Hueco reservado para el trazo manuscrito (misma geometría que el resto de
  // documentos del sistema: alto suficiente para que no invada el nombre).
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

  page.drawText(
    "Documento generado electrónicamente — la firma eIDAS adjunta acredita su validez.",
    { x: MARGIN_X, y: 48, size: 8, font, color: rgb(0.55, 0.6, 0.66) },
  );

  const bytes = await pdf.save();
  return { buffer: Buffer.from(bytes), posicionFirma };
}
