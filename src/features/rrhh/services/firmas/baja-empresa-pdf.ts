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
import type { TipoBajaContrato } from "@/features/rrhh/data/campos-gestoria";

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
  /**
   * Tipo de baja. De él depende TODO el cuerpo de la carta: cada extinción tiene
   * su norma, sus plazos y sus menciones obligatorias, y una carta genérica sirve
   * de poco el día que hay que defenderla.
   */
  tipoBaja?: TipoBajaContrato;
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

  // ─── Cuerpo: cambia entero según el tipo de baja ──────────────
  const tipo: TipoBajaContrato = input.tipoBaja ?? "otras";
  const empresaSeg: Seg[] = [
    { t: "Por medio de la presente, la empresa " },
    { t: input.empresaNombre, bold: true },
    { t: input.empresaCif ? ` (CIF ${input.empresaCif})` : "" },
  ];

  if (tipo === "disciplinaria") {
    drawParagraph([
      ...empresaSeg,
      { t: " le comunica la " },
      { t: "extinción de su contrato de trabajo por despido disciplinario", bold: true },
      { t: ", al amparo del artículo 54 del Estatuto de los Trabajadores." },
    ], LINE_HEIGHT * 2);
  } else if (tipo === "despido_objetivo") {
    drawParagraph([
      ...empresaSeg,
      { t: " le comunica la " },
      { t: "extinción de su contrato de trabajo por causas objetivas", bold: true },
      { t: ", al amparo de los artículos 52 y 53 del Estatuto de los Trabajadores." },
    ], LINE_HEIGHT * 2);
  } else if (tipo === "no_superado_periodo_prueba") {
    drawParagraph([
      ...empresaSeg,
      { t: " le comunica que " },
      { t: "no ha superado el periodo de prueba", bold: true },
      {
        t: " pactado en su contrato de trabajo, por lo que esta empresa desiste de la relación laboral al amparo del artículo 14 del Estatuto de los Trabajadores.",
      },
    ], LINE_HEIGHT * 2);
  } else if (tipo === "fin_contrato") {
    drawParagraph([
      ...empresaSeg,
      { t: " le comunica la " },
      { t: "extinción de su contrato de trabajo por finalización del tiempo convenido", bold: true },
      { t: ", conforme al artículo 49.1.c) del Estatuto de los Trabajadores." },
    ], LINE_HEIGHT * 2);
  } else if (tipo === "voluntaria") {
    drawParagraph([
      { t: "Por medio de la presente se deja constancia de que usted ha comunicado a la empresa " },
      { t: input.empresaNombre, bold: true },
      { t: input.empresaCif ? ` (CIF ${input.empresaCif})` : "" },
      { t: " su voluntad de " },
      { t: "causar baja voluntaria", bold: true },
      { t: ", por lo que la empresa procede a tramitar su baja en los términos que se indican." },
    ], LINE_HEIGHT * 2);
  } else {
    drawParagraph([
      ...empresaSeg,
      { t: " le comunica la " },
      { t: "extinción de su relación laboral", bold: true },
      { t: ", bajo la modalidad de " },
      { t: input.tipoBajaLabel, bold: true },
      { t: "." },
    ], LINE_HEIGHT * 2);
  }

  // Fechas: las mismas para todos los tipos, y siempre las dos.
  drawParagraph([
    { t: "Su último día de prestación de servicios será el " },
    { t: input.ultimoDia, bold: true },
    { t: ", surtiendo efectos la baja el " },
    { t: input.diaOficial, bold: true },
    { t: "." },
  ], LINE_HEIGHT * 2);

  // ─── Hechos ───────────────────────────────────────────────────
  // Van SIEMPRE, sea cual sea el tipo: es la descripción de la situación por la
  // que se le comunica la baja, y es lo primero que se mira si esto se discute.
  // Sin límite de extensión: si ocupan dos hojas, ocupan dos hojas.
  if (input.hechos?.trim()) {
    const tituloHechos =
      tipo === "disciplinaria"
        ? "Hechos que motivan esta decisión:"
        : tipo === "despido_objetivo"
          ? "Causa objetiva en la que se funda esta decisión:"
          : tipo === "no_superado_periodo_prueba"
            ? "Valoración del periodo de prueba:"
            : tipo === "voluntaria"
              ? "Constancia de la comunicación recibida:"
              : "Motivo de la baja:";
    asegurarEspacio(LINE_HEIGHT * 3);
    drawParagraph([{ t: tituloHechos, bold: true }], LINE_HEIGHT);
    for (const linea of input.hechos.trim().split(/\n+/)) {
      if (!linea.trim()) continue;
      drawParagraph([{ t: linea.trim() }], LINE_HEIGHT);
    }
    y -= LINE_HEIGHT;
  }

  // ─── Menciones propias de cada tipo ───────────────────────────
  if (tipo === "disciplinaria") {
    asegurarEspacio(LINE_HEIGHT * 3);
    drawParagraph([
      {
        t: "Los hechos descritos constituyen un incumplimiento grave y culpable de sus obligaciones contractuales.",
      },
    ], LINE_HEIGHT * 2);
  }

  if (tipo === "despido_objetivo") {
    asegurarEspacio(LINE_HEIGHT * 5);
    drawParagraph([
      { t: "Simultáneamente a la entrega de esta comunicación se pone a su disposición la " },
      { t: "indemnización legal de veinte días de salario por año de servicio", bold: true },
      {
        t: ", prorrateándose por meses los periodos inferiores al año y con un máximo de doce mensualidades.",
      },
    ], LINE_HEIGHT * 2);
    drawParagraph([
      {
        t: "Durante el periodo de preaviso dispondrá de una licencia de seis horas semanales, retribuidas, para buscar un nuevo empleo.",
      },
    ], LINE_HEIGHT * 2);
  }

  if (tipo === "fin_contrato") {
    asegurarEspacio(LINE_HEIGHT * 3);
    drawParagraph([
      {
        t: "Se le abonará, junto con la liquidación, la indemnización que legalmente corresponda por finalización de contrato.",
      },
    ], LINE_HEIGHT * 2);
  }

  if (tipo === "no_superado_periodo_prueba") {
    asegurarEspacio(LINE_HEIGHT * 3);
    drawParagraph([
      {
        t: "El desistimiento durante el periodo de prueba no requiere preaviso ni da derecho a indemnización, conforme al artículo 14 del Estatuto de los Trabajadores.",
      },
    ], LINE_HEIGHT * 2);
  }

  // ─── Liquidación ──────────────────────────────────────────────
  drawParagraph([
    {
      t: "Se pone a su disposición la liquidación de haberes que le corresponda hasta la fecha de efectos indicada.",
    },
  ], LINE_HEIGHT * 2);

  // Plazo de impugnación: solo donde existe como tal.
  if (tipo === "disciplinaria" || tipo === "despido_objetivo") {
    asegurarEspacio(LINE_HEIGHT * 3);
    drawParagraph([
      {
        t: "Contra esta decisión podrá reclamar ante la jurisdicción social en el plazo de veinte días hábiles a contar desde la fecha de efectos.",
      },
    ], LINE_HEIGHT * 2);
  }

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
