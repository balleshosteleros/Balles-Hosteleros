/**
 * Generador del PDF "Anexo de novación de contrato por cambio de puesto".
 *
 * Documento que el trabajador firma cuando es PROMOCIONADO / cambia de puesto
 * dentro de la empresa (promoción interna). Deja constancia legal del cambio:
 * puesto anterior → nuevo puesto, nuevas condiciones (jornada, tipo de contrato,
 * salario) y fecha de efecto. El acta eIDAS (audit trail) se concatena al firmar.
 *
 * Es un documento PROPIO (no reutiliza el contrato interno): un anexo modifica un
 * contrato preexistente, no crea la relación laboral.
 */

import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface AnexoPromocionInput {
  empleadoNombre: string;
  empleadoDni: string | null;
  empresaNombre: string;
  empresaCif: string | null;
  ciudad: string | null;
  puestoAnterior: string | null;
  puestoNuevo: string;
  fechaEfecto: string; // dd/mm/yyyy — primer día en el nuevo puesto
  fecha: string; // dd/mm/yyyy — fecha de firma
  tipoContrato: string | null;
  jornada: string | null;
  horasSemanales: number | null;
  salarioNeto: number | null;
}

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_X = 64;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;
const MAX_CHARS = 88;
const TINTA = rgb(0.06, 0.09, 0.16);
const GRIS = rgb(0.55, 0.6, 0.66);

function eur(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

export async function generarAnexoPromocionPDF(input: AnexoPromocionInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - 80;

  const nuevaPaginaSiHaceFalta = () => {
    if (y < 130) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 80;
    }
  };

  const escribir = (texto: string, opts?: { bold?: boolean; size?: number }) => {
    const f = opts?.bold ? fontBold : font;
    const size = opts?.size ?? FONT_SIZE;
    page.drawText(texto, { x: MARGIN_X, y, size, font: f, color: TINTA });
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
  page.drawText("ANEXO DE MODIFICACIÓN DE CONTRATO", { x: MARGIN_X, y, size: 16, font: fontBold, color: TINTA });
  y -= 8;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, thickness: 0.8, color: rgb(0.6, 0.65, 0.72) });
  y -= 12;
  escribir("Cambio de puesto / promoción interna", { bold: false, size: 10 });
  y -= 12;
  nuevaPaginaSiHaceFalta();

  // ─── Encabezado: empresa, ciudad y fecha ────────────────
  escribir(input.empresaNombre, { bold: true });
  if (input.empresaCif) escribir(`CIF: ${input.empresaCif}`);
  escribir(`${input.ciudad ?? "—"}, a ${input.fecha}.`);
  y -= LINE_HEIGHT;
  nuevaPaginaSiHaceFalta();

  // ─── Cuerpo ─────────────────────────────────────────────
  escribirParrafo(
    `Por el presente anexo, ${input.empresaNombre} y D./Dña. ${input.empleadoNombre}` +
      (input.empleadoDni ? ` (DNI/NIE ${input.empleadoDni})` : "") +
      `, acuerdan modificar de común acuerdo las condiciones del contrato de trabajo vigente entre ambas partes, con efectos desde el ${input.fechaEfecto}, en los siguientes términos:`,
  );
  y -= 4;

  escribir("Puesto", { bold: true });
  escribirParrafo(
    `El/la trabajador/a pasa a desempeñar el puesto de «${input.puestoNuevo}»` +
      (input.puestoAnterior ? `, en sustitución del puesto anterior de «${input.puestoAnterior}».` : "."),
  );
  y -= 4;

  escribir("Nuevas condiciones", { bold: true });
  if (input.tipoContrato) escribirParrafo(`· Tipo de contrato: ${input.tipoContrato}`);
  if (input.jornada) escribirParrafo(`· Jornada: ${input.jornada}`);
  if (input.horasSemanales != null) escribirParrafo(`· Horas semanales: ${input.horasSemanales} h`);
  escribirParrafo(`· Retribución (neto de referencia): ${eur(input.salarioNeto)}`);
  y -= 4;

  escribirParrafo(
    "Las restantes condiciones del contrato de trabajo no modificadas expresamente por el presente anexo permanecen vigentes en sus mismos términos. Ambas partes firman en conformidad.",
  );

  // ─── Línea de firma ─────────────────────────────────────
  y -= LINE_HEIGHT * 3;
  nuevaPaginaSiHaceFalta();
  escribir("Firmado:", { bold: true });
  escribir(input.empleadoNombre);
  if (input.empleadoDni) escribir(`DNI/NIE: ${input.empleadoDni}`);

  // ─── Footer ─────────────────────────────────────────────
  page.drawText(
    "Documento generado electrónicamente — la firma eIDAS adjunta acredita su validez.",
    { x: MARGIN_X, y: 48, size: 8, font, color: GRIS },
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
