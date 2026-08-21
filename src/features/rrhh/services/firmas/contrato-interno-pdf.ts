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
import { dibujarCabecera, type MarcaEmpresa } from "@/lib/pdf/cabecera-documento";

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
  /** Logo de la empresa para la cabecera (Ajustes → Imagen de marca). */
  marca?: MarcaEmpresa | null;
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

/** Dónde estampar la firma, medido por el propio generador. */
export interface PosicionFirmaDefault {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
  altoPct: number;
}

export interface ContratoInternoResult {
  buffer: Buffer;
  posicionFirma: PosicionFirmaDefault;
}

export async function generarContratoInternoPDF(
  input: ContratoInternoInput,
): Promise<ContratoInternoResult> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - 80;
  // El cuerpo del contrato es configurable, así que "Firmado:" puede caer en
  // cualquier página. Llevamos la cuenta para situar la firma donde de verdad
  // queda el hueco, en vez de asumir la página 1 a una altura fija.
  let paginaActual = 1;

  const nuevaPaginaSiHaceFalta = () => {
    if (y < 120) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 80;
      paginaActual += 1;
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

  // ─── Cabecera común: logo de la empresa centrado + título ───
  y = await dibujarCabecera({
    pdf,
    page,
    pageW: PAGE_W,
    pageH: PAGE_H,
    marginX: MARGIN_X,
    titulo: "CONTRATO PRIVADO DE TRABAJO",
    fontBold,
    font,
    marca: input.marca ?? null,
  });

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

  // Hueco del trazo manuscrito: se reserva ANTES de escribir el nombre y el DNI,
  // para que la firma no caiga encima de ellos.
  const FIRMA_ALTO = 66;
  y -= 6;
  const firmaTopY = y;
  const firmaPagina = paginaActual;
  y -= FIRMA_ALTO;
  nuevaPaginaSiHaceFalta();

  escribir(input.empleadoNombre);
  if (input.empleadoDni) escribir(`DNI/NIE: ${input.empleadoDni}`);

  // ─── Footer ─────────────────────────────────────────────
  page.drawText(
    "Documento generado electrónicamente — la firma eIDAS adjunta acredita su validez.",
    { x: MARGIN_X, y: 48, size: 8, font, color: rgb(0.55, 0.6, 0.66) },
  );

  const bytes = await pdf.save();
  return {
    buffer: Buffer.from(bytes),
    posicionFirma: {
      pagina: firmaPagina,
      xPct: MARGIN_X / PAGE_W,
      // Origen ARRIBA-izquierda, que es lo que espera el estampador.
      yPct: (PAGE_H - firmaTopY) / PAGE_H,
      anchoPct: 0.32,
      altoPct: FIRMA_ALTO / PAGE_H,
    },
  };
}
