import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

/**
 * Genera el PDF de una SANCIÓN DISCIPLINARIA (Comunicados → Sanción
 * disciplinaria). Es el documento oficial que la empresa entrega al trabajador
 * y que este firma como «leído / informado» (no implica conformidad). El PDF
 * generado entra en el pipeline de firmas (`firmas_documentos`) y, una vez
 * firmado, se archiva en la carpeta de documentos del empleado.
 *
 * La banda de firma se MIDE al dibujarla y se devuelve en `posicionFirma`: es la
 * regla del proyecto (el sistema decide dónde va el trazo, nunca el firmante) y
 * aquí es obligatorio porque el documento crece con los hechos que se redacten,
 * así que la banda cae en una página y una altura distintas en cada sanción.
 */

export type GravedadSancion = "leve" | "grave" | "muy_grave";

/** Caja del trazo manuscrito, en % de la página y con origen ARRIBA-izquierda. */
export interface PosicionFirmaSancion {
  /** Página 1-indexada donde está la banda de firma. */
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
  altoPct: number;
}

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

/**
 * La fuente estándar del PDF (Helvetica / WinAnsi) no sabe dibujar caracteres
 * fuera del alfabeto occidental: un emoji pegado en los hechos reventaba la
 * generación entera y la sanción no llegaba a enviarse. Se quitan antes de
 * escribir, que es preferible a perder el documento.
 */
function textoPdf(text: string): string {
  return (text || "").replace(
    /[^\x20-\x7E\xA0-\xFF\n\r\t\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/g,
    "",
  );
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of textoPdf(text).split("\n")) {
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

export async function generarSancionPdf(
  datos: DatosSancion,
): Promise<{ bytes: Uint8Array; posicionFirma: PosicionFirmaSancion }> {
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
  /** Página actual, 1-indexada: es la que necesita el estampador de la firma. */
  let paginaActual = 1;

  const nuevaPagina = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    paginaActual += 1;
    y = pageHeight - margin;
  };

  const nuevaPaginaSiHaceFalta = (alturaNecesaria: number) => {
    if (y - alturaNecesaria < margin + 120) nuevaPagina();
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
    textoPdf(`${datos.empresaNombre}${datos.empresaCif ? ` · CIF ${datos.empresaCif}` : ""}`),
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
      if (y < margin + 130) nuevaPagina();
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

  // Banda reservada a la firma manuscrita del trabajador. Se reserva ENTERA en
  // una sola página: si no cabe, se pasa a la siguiente antes de dibujarla, para
  // que el recuadro y el trazo no queden partidos entre dos hojas.
  const FIRMA_ALTO = 70;
  nuevaPaginaSiHaceFalta(FIRMA_ALTO + 30);
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
    y: y - FIRMA_ALTO,
    width: contentWidth,
    height: FIRMA_ALTO,
    borderColor: colorRule,
    borderWidth: 1,
  });

  // La posición se MIDE aquí, sobre el recuadro que se acaba de dibujar. Antes
  // se devolvía una caja fija (86 % de la página) que solo coincidía por
  // casualidad: con unos hechos largos el trazo caía sobre el texto.
  const posicionFirma: PosicionFirmaSancion = {
    pagina: paginaActual,
    xPct: margin / pageWidth,
    yPct: (pageHeight - y) / pageHeight,
    anchoPct: 0.42,
    altoPct: FIRMA_ALTO / pageHeight,
  };

  return { bytes: await pdf.save(), posicionFirma };
}


/** Datos de la apertura y del cierre que se sellan en el propio documento. */
export interface SelloSancion {
  /** Primera vez que el trabajador abrió el documento (ISO). */
  abiertoEn: string | null;
  /** Momento en que firmó o declaró haberlo leído (ISO). */
  cerradoEn: string;
  ip: string | null;
  userAgent: string | null;
  /** Zona horaria de la empresa: las horas se sellan en SU reloj. */
  zonaHoraria: string;
  /** false = se negó a firmar; el documento se marca NO FIRMADO en rojo. */
  firmado: boolean;
}

function fechaLarga(iso: string | null, tz: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const texto = d.toLocaleString("es-ES", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  let zona = "";
  try {
    const tzName = new Intl.DateTimeFormat("es-ES", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(d)
      .find(p => p.type === "timeZoneName")?.value;
    if (tzName) zona = ` (${tzName})`;
  } catch {
    zona = "";
  }
  return texto + zona;
}

/**
 * Sella en la PROPIA hoja de la sanción lo que pasó con ella: cuándo la abrió el
 * trabajador, cuándo quedó informado, desde qué IP y con qué navegador. Y, si se
 * negó a firmar, un NO FIRMADO en rojo sobre la banda de la firma.
 *
 * El acta de auditoría que se pega detrás ya guarda todo el rastro, pero el acta
 * es una hoja aparte: quien abre el PDF tiene que ver en la primera página, sin
 * pasar página, si está firmado o no y cuándo se le informó.
 */
export async function sellarSancion(
  pdfBytes: Uint8Array,
  posicion: PosicionFirmaSancion,
  sello: SelloSancion,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const indice = Math.min(Math.max(posicion.pagina, 1), pdf.getPageCount()) - 1;
  const page = pdf.getPage(indice);
  const { width: pw, height: ph } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const rojo = rgb(0.78, 0.11, 0.11);
  const gris = rgb(0.45, 0.5, 0.6);

  const x = posicion.xPct * pw;
  const ancho = pw - x * 2;
  const cajaTop = ph - posicion.yPct * ph;
  const cajaAlto = posicion.altoPct * ph;
  const cajaBottom = cajaTop - cajaAlto;

  if (!sello.firmado) {
    // Marca en rojo DENTRO de la banda de firma, donde se esperaba el trazo.
    const etiqueta = "NO FIRMADO";
    const size = 22;
    const anchoTexto = fontBold.widthOfTextAtSize(etiqueta, size);
    page.drawRectangle({
      x,
      y: cajaBottom,
      width: ancho,
      height: cajaAlto,
      borderColor: rojo,
      borderWidth: 1.5,
    });
    page.drawText(etiqueta, {
      x: x + (ancho - anchoTexto) / 2,
      y: cajaBottom + cajaAlto / 2 - 2,
      size,
      font: fontBold,
      color: rojo,
    });
    const pie = "El trabajador/a fue informado/a y declaró haber leído el documento; se negó a firmarlo.";
    page.drawText(textoPdf(pie), {
      x: x + (ancho - font.widthOfTextAtSize(pie, 8)) / 2,
      y: cajaBottom + 8,
      size: 8,
      font,
      color: rojo,
    });
  }

  // Constancia de la apertura y del cierre, siempre: firmada o no.
  const lineas = [
    `Documento abierto por el trabajador/a: ${fechaLarga(sello.abiertoEn, sello.zonaHoraria)}`,
    sello.firmado
      ? `Firmado como acuse de recibo: ${fechaLarga(sello.cerradoEn, sello.zonaHoraria)}`
      : `Informado y declarado leído (sin firma): ${fechaLarga(sello.cerradoEn, sello.zonaHoraria)}`,
    `IP ${sello.ip ?? "—"} · Navegador ${(sello.userAgent ?? "—").slice(0, 78)}`,
  ];
  let yLinea = cajaBottom - 14;
  for (const linea of lineas) {
    if (yLinea < 24) break;
    page.drawText(textoPdf(linea), { x, y: yLinea, size: 8, font, color: gris });
    yLinea -= 11;
  }

  return pdf.save();
}
