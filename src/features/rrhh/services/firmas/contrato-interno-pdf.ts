/**
 * Generador del PDF "Contrato interno" que el trabajador firma al entrar en la
 * fase de Contratación (PRP-070), antes de comenzar a trabajar.
 *
 * Una sola hoja A4 con el texto del compromiso interno entre empresa y
 * trabajador: confirma que ha recibido la formación, que conoce las normas
 * internas, que su alta ha sido procesada y que acepta las condiciones internas
 * explicadas. El acta eIDAS (audit trail) se concatena automáticamente al firmar.
 *
 * El cuerpo del documento es CONFIGURABLE por empresa (PLANTILLAS → Documentos →
 * Contrato interno). Si no hay plantilla guardada se usa `CONTRATO_INTERNO_DEFAULT`.
 */

import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ContratoInternoInput {
  empleadoNombre: string;
  empleadoDni: string | null;
  empresaNombre: string;
  empresaCif: string | null;
  ciudad: string | null;
  puesto: string | null;
  fecha: string; // dd/mm/yyyy
  /** Cuerpo configurable (con placeholders ya sustituidos). null = usar default. */
  cuerpo?: string | null;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 64;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;
const MAX_CHARS = 88; // ancho aproximado de línea para el wrap

// Texto por defecto y sustitución de placeholders viven en un módulo plano para
// poder compartirlos con el editor (cliente). Se reexportan por compatibilidad.
export {
  CONTRATO_INTERNO_DEFAULT,
  sustituirContratoInterno,
} from "@/features/rrhh/services/firmas/contrato-interno-texto";
import { CONTRATO_INTERNO_DEFAULT, sustituirContratoInterno } from "@/features/rrhh/services/firmas/contrato-interno-texto";

export async function generarContratoInternoPDF(
  input: ContratoInternoInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - 80;

  const nuevaPaginaSiHaceFalta = () => {
    if (y < 120) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 80;
    }
  };

  const escribir = (texto: string, opts?: { bold?: boolean; size?: number }) => {
    const f = opts?.bold ? fontBold : font;
    const size = opts?.size ?? FONT_SIZE;
    page.drawText(texto, { x: MARGIN_X, y, size, font: f, color: rgb(0.06, 0.09, 0.16) });
    y -= LINE_HEIGHT;
    nuevaPaginaSiHaceFalta();
  };

  const escribirParrafo = (parrafo: string) => {
    if (parrafo.trim() === "") {
      y -= LINE_HEIGHT;
      nuevaPaginaSiHaceFalta();
      return;
    }
    const palabras = parrafo.split(/\s+/);
    let linea = "";
    for (const w of palabras) {
      if ((linea + " " + w).trim().length > MAX_CHARS) {
        escribir(linea);
        linea = w;
      } else {
        linea = linea ? `${linea} ${w}` : w;
      }
    }
    if (linea) escribir(linea);
  };

  // ─── Título ─────────────────────────────────────────────
  page.drawText("CONTRATO PRIVADO DE TRABAJO", { x: MARGIN_X, y, size: 16, font: fontBold, color: rgb(0.06, 0.09, 0.16) });
  y -= 8;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, thickness: 0.8, color: rgb(0.6, 0.65, 0.72) });
  y -= 28;

  // ─── Encabezado: empresa, ciudad y fecha ────────────────
  escribir(input.empresaNombre, { bold: true });
  if (input.empresaCif) escribir(`CIF: ${input.empresaCif}`);
  escribir(`${input.ciudad ?? "—"}, a ${input.fecha}.`);
  y -= LINE_HEIGHT;
  nuevaPaginaSiHaceFalta();

  // ─── Cuerpo (configurable) ──────────────────────────────
  const cuerpo = (input.cuerpo && input.cuerpo.trim()) || CONTRATO_INTERNO_DEFAULT;
  const cuerpoFinal = sustituirContratoInterno(cuerpo, {
    nombre: input.empleadoNombre,
    dni: input.empleadoDni,
    empresa: input.empresaNombre,
    puesto: input.puesto,
    ciudad: input.ciudad,
    fecha: input.fecha,
  });
  for (const parrafo of cuerpoFinal.split(/\n/)) {
    escribirParrafo(parrafo);
  }

  // ─── Línea de firma ─────────────────────────────────────
  y -= LINE_HEIGHT * 3;
  nuevaPaginaSiHaceFalta();
  escribir("Firmado:", { bold: true });
  escribir(input.empleadoNombre);
  if (input.empleadoDni) escribir(`DNI/NIE: ${input.empleadoDni}`);

  // ─── Footer ─────────────────────────────────────────────
  page.drawText(
    "Documento generado electrónicamente — la firma eIDAS adjunta acredita su validez.",
    { x: MARGIN_X, y: 48, size: 8, font, color: rgb(0.55, 0.6, 0.66) },
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
