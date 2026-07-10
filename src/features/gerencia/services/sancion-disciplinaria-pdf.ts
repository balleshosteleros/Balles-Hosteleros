import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

/**
 * Genera el PDF de una SANCIÓN DISCIPLINARIA (Comunicados → Sanción
 * disciplinaria). Es el documento oficial que la empresa entrega al trabajador
 * y que este firma como «leído / informado» (no implica conformidad). El PDF
 * generado entra en el pipeline de firmas (`firmas_documentos`) y, una vez
 * firmado, se archiva en la carpeta de documentos del empleado.
 *
 * Se reserva una banda en la última página para la firma manuscrita: el motor de
 * firma coloca el trazo según `posicion_firma_default` (misma mecánica que el
 * resto de documentos firmables del proyecto).
 */

export type GravedadSancion = "leve" | "grave" | "muy_grave";

export const GRAVEDAD_LABEL: Record<GravedadSancion, string> = {
  leve: "Falta leve",
  grave: "Falta grave",
  muy_grave: "Falta muy grave",
};

export type DatosSancion = {
  empresaNombre: string;
  empresaCif?: string | null;
  empleadoNombre: string;
  empleadoDni?: string | null;
  puesto?: string | null;
  departamento?: string | null;
  gravedad: GravedadSancion;
  /** Fecha de los hechos (YYYY-MM-DD) o texto libre. */
  fechaHechos?: string | null;
  /** Descripción de los hechos que motivan la sanción. */
  hechos: string;
  /** Norma/convenio/artículo infringido (opcional). */
  normaInfringida?: string | null;
  /** Medida disciplinaria adoptada (p. ej. amonestación por escrito, suspensión…). */
  medida: string;
  /** Fecha de emisión (YYYY-MM-DD). */
  fechaEmision: string;
  /** Firmante por la empresa (nombre y cargo). */
  emitidoPor?: string | null;
};

const GRAVEDAD_COLOR: Record<GravedadSancion, ReturnType<typeof rgb>> = {
  leve: rgb(0.85, 0.55, 0.05),
  grave: rgb(0.86, 0.3, 0.08),
  muy_grave: rgb(0.78, 0.11, 0.11),
};

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of (text || "").split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        out.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export async function generarSancionPdf(datos: DatosSancion): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;

  const colorTitulo = rgb(0.06, 0.09, 0.16);
  const colorLabel = rgb(0.45, 0.5, 0.6);
  const colorTexto = rgb(0.12, 0.16, 0.23);
  const colorMuted = rgb(0.6, 0.65, 0.72);
  const colorRule = rgb(0.88, 0.9, 0.93);
  const gravColor = GRAVEDAD_COLOR[datos.gravedad];

  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const nuevaPaginaSiHaceFalta = (alturaNecesaria: number) => {
    if (y - alturaNecesaria < margin + 120) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // Cabecera con banda de gravedad.
  page.drawRectangle({ x: margin, y: y - 4, width: 46, height: 20, color: gravColor });
  page.drawText(GRAVEDAD_LABEL[datos.gravedad].toUpperCase(), {
    x: margin + 56,
    y,
    size: 9,
    font: fontBold,
    color: gravColor,
  });
  y -= 26;
  page.drawText("COMUNICACIÓN DE SANCIÓN DISCIPLINARIA", {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: colorTitulo,
  });
  y -= 20;
  page.drawText(
    `${datos.empresaNombre}${datos.empresaCif ? ` · CIF ${datos.empresaCif}` : ""}`,
    { x: margin, y, size: 10, font, color: colorMuted },
  );
  y -= 24;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: colorRule,
  });
  y -= 22;

  const drawField = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x: margin, y, size: 8, font: fontBold, color: colorLabel });
    y -= 13;
    for (const ln of wrap(value, font, 10.5, contentWidth)) {
      page.drawText(ln, { x: margin, y, size: 10.5, font, color: colorTexto });
      y -= 14;
    }
    y -= 6;
  };

  const drawParrafo = (label: string, value: string) => {
    const lines = wrap(value || "—", font, 10.5, contentWidth);
    nuevaPaginaSiHaceFalta(20 + lines.length * 14);
    page.drawText(label.toUpperCase(), { x: margin, y, size: 8, font: fontBold, color: colorLabel });
    y -= 14;
    for (const ln of lines) {
      if (y < margin + 130) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(ln, { x: margin, y, size: 10.5, font, color: colorTexto });
      y -= 14;
    }
    y -= 8;
  };

  drawField(
    "Trabajador/a",
    `${datos.empleadoNombre}${datos.empleadoDni ? ` · DNI/NIE ${datos.empleadoDni}` : ""}`,
  );
  if (datos.puesto || datos.departamento) {
    drawField(
      "Puesto / Departamento",
      [datos.puesto, datos.departamento].filter(Boolean).join(" · ") || "—",
    );
  }
  drawField("Calificación de la falta", GRAVEDAD_LABEL[datos.gravedad]);
  drawField("Fecha de los hechos", fmtFecha(datos.fechaHechos));

  drawParrafo("Hechos que motivan la sanción", datos.hechos);
  if (datos.normaInfringida?.trim()) {
    drawParrafo("Norma / convenio infringido", datos.normaInfringida);
  }
  drawParrafo("Medida disciplinaria adoptada", datos.medida);

  // Cláusula de acuse de recibo (leído, no conforme).
  nuevaPaginaSiHaceFalta(120);
  y -= 4;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: colorRule,
  });
  y -= 16;
  const clausula =
    "Mediante la firma de este documento, el trabajador/a declara haber sido informado/a y haber " +
    "recibido la presente comunicación de sanción disciplinaria. La firma constituye únicamente acuse " +
    "de recibo y de lectura; NO implica conformidad ni aceptación de los hechos ni de la medida " +
    "adoptada. El trabajador/a conserva su derecho a impugnar la sanción por los cauces legales " +
    "previstos.";
  for (const ln of wrap(clausula, font, 9.5, contentWidth)) {
    page.drawText(ln, { x: margin, y, size: 9.5, font, color: colorMuted });
    y -= 13;
  }
  y -= 10;

  drawField("Emitido por", `${datos.emitidoPor?.trim() || datos.empresaNombre} · ${fmtFecha(datos.fechaEmision)}`);

  // Banda reservada a la firma manuscrita del trabajador (última página).
  y -= 6;
  page.drawText("FIRMA DEL TRABAJADOR/A (LEÍDO Y RECIBIDO)", {
    x: margin,
    y,
    size: 8,
    font: fontBold,
    color: colorLabel,
  });
  y -= 8;
  page.drawRectangle({
    x: margin,
    y: y - 70,
    width: contentWidth,
    height: 70,
    borderColor: colorRule,
    borderWidth: 1,
  });

  return pdf.save();
}

/**
 * Posición por defecto de la firma sobre el documento, en porcentajes relativos
 * a la página, coincidiendo con la banda reservada arriba. La última página es
 * la que contiene la banda; el motor de firma usa `pagina` 1-indexado, así que
 * calculamos la última al vuelo en el llamador. Aquí devolvemos el layout de la
 * caja (x/y/ancho en %). El alto lo decide el motor por el ratio del trazo.
 */
export const SANCION_FIRMA_LAYOUT = {
  xPct: 0.1,
  yPct: 0.86,
  anchoPct: 0.5,
} as const;
