import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EventoAuditoria, TipoEventoFirma } from "./audit";

const TIPO_LABEL: Record<TipoEventoFirma, string> = {
  creado: "Documento creado",
  enviado: "Invitación enviada",
  reenviado: "Reenviado",
  abierto: "Documento abierto",
  otp_enviado: "Código OTP enviado",
  otp_validado: "Código OTP validado",
  otp_fallido: "Intento de OTP fallido",
  otp_bloqueado: "OTP bloqueado por intentos",
  firmado: "Documento firmado",
  rechazado: "Documento rechazado",
  expirado: "Plazo expirado",
};

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

export type DatosActa = {
  documentoId: string;
  titulo: string;
  tipo: string;
  modalidad: string;
  validez: string;
  empresaNombre: string;
  empleadoNombre: string;
  empleadoDni: string | null;
  empleadoEmail: string | null;
  enviadoPor: string;
  enviadoEn: string;
  firmadoEn: string;
  ipFirma: string | null;
  userAgent: string | null;
  sha256Original: string;
  trazoFirmaPng?: Uint8Array | null;
};

export async function generarActa(
  datos: DatosActa,
  eventos: EventoAuditoria[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.Courier);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;
  const colorTitulo = rgb(0.06, 0.09, 0.16);
  const colorLabel = rgb(0.45, 0.5, 0.6);
  const colorTexto = rgb(0.12, 0.16, 0.23);
  const colorAccent = rgb(0.39, 0.4, 0.95);
  const colorMuted = rgb(0.6, 0.65, 0.72);
  const colorRule = rgb(0.88, 0.9, 0.93);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText("ACTA DE FIRMA ELECTRÓNICA", {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: colorTitulo,
  });
  y -= 22;
  page.drawText(
    `Reglamento (UE) 910/2014 (eIDAS) — Firma ${datos.validez.replace("eidas_", "").replace("_", " ")}`,
    { x: margin, y, size: 10, font, color: colorMuted },
  );
  y -= 26;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: colorRule,
  });
  y -= 18;

  const drawField = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), {
      x: margin,
      y,
      size: 8,
      font: fontBold,
      color: colorLabel,
    });
    y -= 12;
    const lines = wrap(value, font, 10, contentWidth);
    for (const ln of lines) {
      page.drawText(ln, { x: margin, y, size: 10, font, color: colorTexto });
      y -= 13;
    }
    y -= 4;
  };
  const drawFieldMono = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), {
      x: margin,
      y,
      size: 8,
      font: fontBold,
      color: colorLabel,
    });
    y -= 12;
    const lines = wrap(value, fontMono, 9, contentWidth);
    for (const ln of lines) {
      page.drawText(ln, { x: margin, y, size: 9, font: fontMono, color: colorTexto });
      y -= 12;
    }
    y -= 4;
  };

  drawField("Documento", datos.titulo);
  drawField("Tipo", datos.tipo);
  drawField("Empresa requirente", datos.empresaNombre);
  drawField(
    "Firmante",
    `${datos.empleadoNombre}${datos.empleadoDni ? ` · DNI/NIE ${datos.empleadoDni}` : ""}${datos.empleadoEmail ? ` · ${datos.empleadoEmail}` : ""}`,
  );
  drawField("Enviado por", `${datos.enviadoPor} · ${fmtFecha(datos.enviadoEn)}`);
  drawField("Firmado el", fmtFecha(datos.firmadoEn));
  drawField("Modalidad de firma", datos.modalidad);
  drawField(
    "Datos del firmante en el momento de la firma",
    `IP: ${datos.ipFirma ?? "—"} · User-Agent: ${datos.userAgent ?? "—"}`,
  );
  drawFieldMono(
    "Hash SHA-256 del documento original",
    datos.sha256Original,
  );
  drawFieldMono("Identificador interno", datos.documentoId);

  if (datos.trazoFirmaPng && datos.trazoFirmaPng.length > 0) {
    try {
      const png = await pdf.embedPng(datos.trazoFirmaPng);
      const maxW = 240;
      const scale = Math.min(maxW / png.width, 1);
      const w = png.width * scale;
      const h = png.height * scale;
      if (y - h - 40 < margin) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText("TRAZO DE FIRMA", {
        x: margin,
        y,
        size: 8,
        font: fontBold,
        color: colorLabel,
      });
      y -= 12;
      page.drawImage(png, { x: margin, y: y - h, width: w, height: h });
      y -= h + 14;
    } catch {
      // si el PNG es inválido, lo omitimos sin romper el acta
    }
  }

  if (y < 180) {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: colorRule,
  });
  y -= 14;
  page.drawText("REGISTRO DE EVENTOS (audit trail)", {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: colorAccent,
  });
  y -= 16;

  for (const ev of eventos) {
    if (y < margin + 40) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    const cabecera = `${fmtFecha(ev.ocurridoEn)}  ·  ${TIPO_LABEL[ev.tipo] ?? ev.tipo}`;
    page.drawText(cabecera, { x: margin, y, size: 9, font: fontBold, color: colorTexto });
    y -= 11;
    const detalle: string[] = [];
    if (ev.ip) detalle.push(`IP ${ev.ip}`);
    if (ev.userAgent) detalle.push(`UA ${truncar(ev.userAgent, 70)}`);
    if (ev.actorUserId) detalle.push(`actor ${ev.actorUserId.slice(0, 8)}…`);
    if (detalle.length > 0) {
      page.drawText(detalle.join(" · "), {
        x: margin,
        y,
        size: 8,
        font,
        color: colorMuted,
      });
      y -= 10;
    }
    page.drawText(`hash ${ev.hash.slice(0, 24)}…`, {
      x: margin,
      y,
      size: 7,
      font: fontMono,
      color: colorMuted,
    });
    y -= 12;
  }

  return pdf.save();
}

export async function concatenarConActa(
  originalPdf: Uint8Array,
  actaPdf: Uint8Array,
): Promise<Uint8Array> {
  return aplicarFirmaYConcatenar(originalPdf, actaPdf, null, null);
}

export type PosicionFirmaPdf = {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
};

export async function aplicarFirmaYConcatenar(
  originalPdf: Uint8Array,
  actaPdf: Uint8Array,
  trazoPng: Uint8Array | null,
  posicion: PosicionFirmaPdf | null,
): Promise<Uint8Array> {
  const orig = await PDFDocument.load(originalPdf, { ignoreEncryption: true });

  if (trazoPng && posicion) {
    const idx = Math.max(0, Math.min(orig.getPageCount() - 1, posicion.pagina - 1));
    const page = orig.getPage(idx);
    const { width: pw, height: ph } = page.getSize();
    try {
      const png = await orig.embedPng(trazoPng);
      const w = Math.max(20, posicion.anchoPct * pw);
      const ratio = png.width > 0 ? png.height / png.width : 0.35;
      const h = w * ratio;
      const xPdf = Math.max(0, Math.min(pw - w, posicion.xPct * pw));
      // PDF coords (origin bottom-left): convertir desde UI (origin top-left)
      const yPdf = Math.max(0, Math.min(ph - h, ph - posicion.yPct * ph - h));
      page.drawImage(png, { x: xPdf, y: yPdf, width: w, height: h });
    } catch {
      // si el PNG es inválido se omite, el acta seguirá llevando los datos legales
    }
  }

  const final = await PDFDocument.create();
  const stampedBytes = await orig.save();
  const stamped = await PDFDocument.load(stampedBytes);
  const acta = await PDFDocument.load(actaPdf);

  const origPages = await final.copyPages(stamped, stamped.getPageIndices());
  origPages.forEach((p) => final.addPage(p));
  const actaPages = await final.copyPages(acta, acta.getPageIndices());
  actaPages.forEach((p) => final.addPage(p));

  return final.save();
}

function truncar(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function wrap(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const palabras = text.split(/\s+/);
  const lines: string[] = [];
  let actual = "";
  for (const w of palabras) {
    const tentativa = actual ? `${actual} ${w}` : w;
    if (font.widthOfTextAtSize(tentativa, size) > maxWidth) {
      if (actual) lines.push(actual);
      actual = w;
    } else {
      actual = tentativa;
    }
  }
  if (actual) lines.push(actual);
  return lines.length > 0 ? lines : [""];
}
