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

/**
 * Texto por defecto del contrato interno. Admite placeholders que se sustituyen
 * antes de renderizar: {nombre}, {dni}, {empresa}, {puesto}, {ciudad}, {fecha}.
 */
export const CONTRATO_INTERNO_DEFAULT = `Por el presente documento, D./Dña. {nombre}{dni_clausula}, que se incorpora al puesto de {puesto} en {empresa}, declara y acepta lo siguiente:

1. Que ha recibido la formación previa necesaria para el desempeño de su puesto y que ha podido resolver sus dudas sobre el funcionamiento de la empresa.

2. Que conoce y acepta las normas internas, los procedimientos básicos y la forma de trabajar de la empresa, explicados durante la fase de formación.

3. Que comprende las condiciones internas que se le han explicado antes de comenzar a trabajar.

4. Que su alta ha sido procesada y enviada a la gestoría antes de su incorporación.

5. Que se compromete a cumplir las normas internas, a mantener la confidencialidad de la información de la empresa y a desempeñar sus funciones con diligencia y profesionalidad.

Este documento tiene validez interna entre la empresa y el trabajador y se firma con carácter previo al inicio de la prestación de servicios.`;

/** Sustituye los placeholders del cuerpo del contrato interno. */
export function sustituirContratoInterno(
  plantilla: string,
  vars: { nombre: string; dni: string | null; empresa: string; puesto: string | null; ciudad: string | null; fecha: string },
): string {
  const dniClausula = vars.dni ? `, con DNI/NIE ${vars.dni},` : "";
  return plantilla
    .replace(/\{nombre\}/g, vars.nombre)
    .replace(/\{dni_clausula\}/g, dniClausula)
    .replace(/\{dni\}/g, vars.dni ?? "—")
    .replace(/\{empresa\}/g, vars.empresa)
    .replace(/\{puesto\}/g, vars.puesto ?? "—")
    .replace(/\{ciudad\}/g, vars.ciudad ?? "—")
    .replace(/\{fecha\}/g, vars.fecha);
}

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
  page.drawText("CONTRATO INTERNO", { x: MARGIN_X, y, size: 16, font: fontBold, color: rgb(0.06, 0.09, 0.16) });
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
