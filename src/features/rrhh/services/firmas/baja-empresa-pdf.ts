/**
 * Generador del PDF "Comunicación de baja de contrato" que la EMPRESA entrega
 * al trabajador cuando causa su baja (despido, fin de contrato, etc.).
 *
 * Es el espejo de `baja-voluntaria-pdf.ts`: allí escribe el trabajador, aquí
 * escribe la empresa. Una hoja A4 con los datos de ambas partes, el tipo de
 * baja, los HECHOS que la motivan (redactados por RRHH, opcionalmente pulidos
 * con IA), la fecha de efectos y una zona de firma del trabajador.
 *
 * La firma del trabajador aquí es un ACUSE DE RECIBO, no una aceptación: el
 * texto del documento lo dice expresamente para que firmar no pueda
 * interpretarse como conformidad con la decisión. Si el trabajador no firma,
 * el acta eIDAS conserva igualmente la constancia de lectura.
 */

import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dibujarCabecera, type MarcaEmpresa } from "@/lib/pdf/cabecera-documento";

export interface CartaBajaEmpresaInput {
  empleadoNombre: string;
  empleadoDni: string | null;
  empresaNombre: string;
  empresaCif: string | null;
  ciudad: string | null;
  /** dd/mm/yyyy — fecha de emisión de la comunicación. */
  fechaComunicacion: string;
  /** dd/mm/yyyy — último día de prestación de servicios. */
  ultimoDia: string;
  /** dd/mm/yyyy — día oficial de la baja (último + 1). */
  diaOficial: string;
  /** Etiqueta del tipo de baja (Disciplinaria, Fin de contrato…). */
  tipoBajaLabel: string;
  /** Hechos que motivan la baja, ya redactados. */
  hechos: string | null;
  marca?: MarcaEmpresa | null;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 64;
const FONT_SIZE = 11;
const LINE_HEIGHT = 17;
const TEXT_W = PAGE_W - MARGIN_X * 2;

type Seg = { t: string; bold?: boolean };

export interface PosicionFirmaDefault {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
  altoPct: number;
}

export interface CartaBajaEmpresaResult {
  buffer: Buffer;
  posicionFirma: PosicionFirmaDefault;
}

export async function generarCartaBajaEmpresaPDF(
  input: CartaBajaEmpresaInput,
): Promise<CartaBajaEmpresaResult> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const widthOf = (t: string, bold: boolean) =>
    (bold ? fontBold : font).widthOfTextAtSize(t, FONT_SIZE);

  let y = PAGE_H - 90;
  let paginaActual = 1;

  /** Salta de página cuando el contenido llega al pie. */
  function asegurarEspacio(alto: number) {
    if (y - alto > 90) return;
    page = pdf.addPage([PAGE_W, PAGE_H]);
    paginaActual += 1;
    y = PAGE_H - 90;
  }

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
        asegurarEspacio(LINE_HEIGHT);
      }
      if (esEspacio && x === MARGIN_X) continue;
      page.drawText(w.t, { x, y, size: FONT_SIZE, font: w.bold ? fontBold : font });
      x += wWidth;
    }
    y -= gapAfter;
    asegurarEspacio(LINE_HEIGHT);
  }

  // ─── Cabecera: logo + título ──────────────────────────────────
  y = await dibujarCabecera({
    pdf,
    page,
    pageW: PAGE_W,
    pageH: PAGE_H,
    marginX: MARGIN_X,
    titulo: "COMUNICACION DE BAJA DE CONTRATO",
    fontBold,
    font,
    marca: input.marca ?? null,
  });

  // ─── Ciudad y fecha (derecha) ─────────────────────────────────
  const ciudadFecha = `${input.ciudad ?? "—"}, a ${input.fechaComunicacion}`;
  page.drawText(ciudadFecha, {
    x: MARGIN_X + TEXT_W - widthOf(ciudadFecha, false),
    y,
    size: FONT_SIZE,
    font,
  });
  y -= LINE_HEIGHT * 3;

  // ─── Destinatario ─────────────────────────────────────────────
  drawParagraph([
    { t: "A la atención de " },
    { t: input.empleadoNombre, bold: true },
    { t: input.empleadoDni ? ` (DNI/NIE ${input.empleadoDni})` : "" },
    { t: "," },
  ], LINE_HEIGHT * 2);

  // ─── Cuerpo ───────────────────────────────────────────────────
  drawParagraph([
    { t: "Por medio de la presente, la empresa " },
    { t: input.empresaNombre, bold: true },
    { t: input.empresaCif ? ` (CIF ${input.empresaCif})` : "" },
    { t: " le comunica la " },
    { t: "extinción de su relación laboral", bold: true },
    { t: ", bajo la modalidad de " },
    { t: input.tipoBajaLabel, bold: true },
    { t: "." },
  ], LINE_HEIGHT * 2);

  drawParagraph([
    { t: "Su último día de prestación de servicios será el " },
    { t: input.ultimoDia, bold: true },
    { t: ", surtiendo efectos la baja el " },
    { t: input.diaOficial, bold: true },
    { t: "." },
  ], LINE_HEIGHT * 2);

  // ─── Hechos ───────────────────────────────────────────────────
  if (input.hechos?.trim()) {
    asegurarEspacio(LINE_HEIGHT * 3);
    drawParagraph([{ t: "Hechos que motivan esta decisión:", bold: true }], LINE_HEIGHT);
    for (const linea of input.hechos.trim().split(/\n+/)) {
      if (!linea.trim()) continue;
      drawParagraph([{ t: linea.trim() }], LINE_HEIGHT);
    }
    y -= LINE_HEIGHT;
  }

  // ─── Liquidación ──────────────────────────────────────────────
  drawParagraph([
    {
      t: "Se pone a su disposición la liquidación de haberes que le corresponda hasta la fecha de efectos indicada.",
    },
  ], LINE_HEIGHT * 2);

  // ─── Acuse de recibo ──────────────────────────────────────────
  asegurarEspacio(LINE_HEIGHT * 8);
  drawParagraph([
    {
      t: "La firma de este documento acredita únicamente su recepción y lectura, y no implica conformidad con la decisión ni renuncia a las acciones que puedan asistirle.",
      bold: true,
    },
  ], LINE_HEIGHT * 2);

  // ─── Firma del trabajador ─────────────────────────────────────
  asegurarEspacio(LINE_HEIGHT * 6);
  page.drawText("Recibí — Firma del trabajador:", {
    x: MARGIN_X,
    y,
    size: FONT_SIZE,
    font: fontBold,
  });
  y -= LINE_HEIGHT;

  // Hueco reservado para el trazo. Se captura su geometría exacta para colocar
  // la firma AUTOMÁTICAMENTE (el empleado nunca la posiciona a mano).
  const FIRMA_ALTO = 66;
  const FIRMA_ANCHO_PCT = 0.32;
  y -= 6;
  const firmaTopY = y;
  const posicionFirma: PosicionFirmaDefault = {
    pagina: paginaActual,
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
