/**
 * Generador del PDF "Carta de baja voluntaria" que el empleado firma
 * cuando solicita una baja de contrato desde Mi Panel.
 *
 * Una sola hoja A4 con texto legal estándar, datos del empleado y empresa,
 * fechas de preaviso y línea de firma. El acta eIDAS (audit trail) se
 * concatena automáticamente al firmar el documento.
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
const LINE_HEIGHT = 16;

export async function generarCartaBajaVoluntariaPDF(
  input: CartaBajaVoluntariaInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - 80;

  // ─── Título ─────────────────────────────────────────────
  page.drawText("CARTA DE BAJA VOLUNTARIA", {
    x: MARGIN_X,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });
  y -= 8;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_W - MARGIN_X, y },
    thickness: 0.8,
    color: rgb(0.6, 0.65, 0.72),
  });
  y -= 28;

  // ─── Encabezado: ciudad y fecha ──────────────────────────
  const ciudadFecha = `${input.ciudad ?? "—"}, a ${input.fechaSolicitud}.`;
  page.drawText(ciudadFecha, { x: MARGIN_X, y, size: FONT_SIZE, font });
  y -= LINE_HEIGHT * 2;

  // ─── A la atención de ────────────────────────────────────
  page.drawText("A la atención de:", { x: MARGIN_X, y, size: FONT_SIZE, font });
  y -= LINE_HEIGHT;
  page.drawText(input.empresaNombre, {
    x: MARGIN_X,
    y,
    size: FONT_SIZE,
    font: fontBold,
  });
  y -= LINE_HEIGHT;
  if (input.empresaCif) {
    page.drawText(`CIF: ${input.empresaCif}`, {
      x: MARGIN_X,
      y,
      size: FONT_SIZE,
      font,
    });
    y -= LINE_HEIGHT;
  }
  y -= LINE_HEIGHT;

  // ─── Cuerpo legal ────────────────────────────────────────
  const body = [
    `Yo, ${input.empleadoNombre}, mayor de edad, ${input.empleadoDni ? `con DNI/NIE ${input.empleadoDni}, ` : ""}empleado/a de la empresa ${input.empresaNombre},`,
    "",
    "Por medio del presente escrito le COMUNICO mi decisión de causar baja voluntaria",
    `en la empresa, con efectos del día ${input.fechaBaja}, último día efectivo de prestación`,
    "de servicios.",
    "",
    `Hago constar que esta comunicación se realiza con un preaviso de ${input.diasPreaviso} días`,
    "naturales, cumpliendo así con lo establecido en el artículo 49.1.d) del Estatuto",
    "de los Trabajadores y, en su caso, lo dispuesto en mi contrato y convenio colectivo",
    "de aplicación.",
    "",
    "Solicito que se proceda al cálculo y abono del finiquito correspondiente, así como",
    "a la entrega de cuanta documentación legal proceda (certificado de empresa,",
    "modelo 145, justificante de cotización, etc.).",
  ];
  for (const line of body) {
    page.drawText(line, { x: MARGIN_X, y, size: FONT_SIZE, font });
    y -= LINE_HEIGHT;
  }

  if (input.motivo) {
    y -= LINE_HEIGHT;
    page.drawText("Motivo expresado por el solicitante:", {
      x: MARGIN_X,
      y,
      size: FONT_SIZE,
      font: fontBold,
    });
    y -= LINE_HEIGHT;
    // Wrap simple (ancho aproximado)
    const max = 80;
    const palabras = input.motivo.split(/\s+/);
    let linea = "";
    for (const w of palabras) {
      if ((linea + " " + w).trim().length > max) {
        page.drawText(linea, { x: MARGIN_X, y, size: FONT_SIZE, font });
        y -= LINE_HEIGHT;
        linea = w;
      } else {
        linea = linea ? `${linea} ${w}` : w;
      }
    }
    if (linea) {
      page.drawText(linea, { x: MARGIN_X, y, size: FONT_SIZE, font });
      y -= LINE_HEIGHT;
    }
  }

  // ─── Cierre ──────────────────────────────────────────────
  y -= LINE_HEIGHT * 2;
  page.drawText(
    "Sin otro particular, le saludo atentamente y quedo a su disposición.",
    { x: MARGIN_X, y, size: FONT_SIZE, font },
  );

  // ─── Línea de firma ──────────────────────────────────────
  y -= LINE_HEIGHT * 4;
  page.drawText("Firmado:", { x: MARGIN_X, y, size: FONT_SIZE, font: fontBold });
  y -= LINE_HEIGHT;
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

  // ─── Footer ──────────────────────────────────────────────
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
  return Buffer.from(bytes);
}
