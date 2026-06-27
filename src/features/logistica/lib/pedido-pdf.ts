/**
 * Generador del PDF de un pedido de compra para enviar al proveedor (§4).
 * Server-side con pdf-lib (mismo patrón que el acta de firmas, sin dependencias de DOM).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type LineaPedidoPDF = {
  producto: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
};

export type DatosPedidoPDF = {
  empresaNombre: string;
  proveedorNombre: string;
  proveedorEmail?: string | null;
  numero?: string | null;
  fecha: string;
  fechaEntrega?: string | null;
  horaEntrega?: string | null;
  horaEntregaHasta?: string | null;
  /** Día de la semana de la fecha de entrega (es). */
  diaSemanaReparto?: string | null;
  /** Franja que el proveedor reparte ese día. */
  franjaProveedor?: string | null;
  /** Días que el proveedor reparte (para el aviso). */
  diasProveedor?: string[];
  /** Descripción legible del reparto del proveedor: "Viernes 09:00-15:00". */
  repartoProveedorTexto?: string | null;
  repartoFueraDia?: boolean;
  repartoFueraHora?: boolean;
  notas?: string | null;
  lineas: LineaPedidoPDF[];
  total: number;
};

const eur = (n: number) => `${n.toFixed(2)} €`;

export async function generarPedidoPDF(d: DatosPedidoPDF): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, margin = 56;
  const right = W - margin;
  const titulo = rgb(0.06, 0.09, 0.16);
  const label = rgb(0.45, 0.5, 0.6);
  const texto = rgb(0.12, 0.16, 0.23);
  const accent = rgb(0.39, 0.4, 0.95);
  const rule = rgb(0.88, 0.9, 0.93);

  let page = pdf.addPage([W, H]);
  let y = H - margin;

  // Cabecera
  page.drawText("PEDIDO DE COMPRA", { x: margin, y, size: 18, font: bold, color: titulo });
  if (d.numero) {
    const t = `Nº ${d.numero}`;
    page.drawText(t, { x: right - bold.widthOfTextAtSize(t, 12), y: y + 2, size: 12, font: bold, color: accent });
  }
  y -= 24;
  page.drawText(`De: ${d.empresaNombre}`, { x: margin, y, size: 10, font, color: texto });
  y -= 14;
  page.drawText(`Para: ${d.proveedorNombre}${d.proveedorEmail ? ` · ${d.proveedorEmail}` : ""}`, { x: margin, y, size: 10, font, color: texto });
  y -= 14;
  const fechas = `Fecha: ${d.fecha}`;
  page.drawText(fechas, { x: margin, y, size: 10, font, color: label });
  y -= 14;
  // Día y hora de reparto
  if (d.fechaEntrega || d.horaEntrega) {
    const dia = d.fechaEntrega
      ? `${d.fechaEntrega}${d.diaSemanaReparto ? ` (${d.diaSemanaReparto})` : ""}`
      : "";
    const horaTxt = d.horaEntrega && d.horaEntregaHasta
      ? `${d.horaEntrega} - ${d.horaEntregaHasta}`
      : (d.horaEntrega || d.horaEntregaHasta || "");
    const reparto = `Reparto: ${dia}${horaTxt ? `   ·   Hora: ${horaTxt}` : ""}`.trim();
    page.drawText(reparto, { x: margin, y, size: 10, font, color: label });
    y -= 20;
  } else {
    y -= 6;
  }

  // Recuadro de PELIGRO: reparto fuera del día/horario estipulado por el proveedor.
  if (d.repartoFueraDia || d.repartoFueraHora) {
    const peligro = rgb(0.86, 0.15, 0.15);
    const peligroBg = rgb(0.99, 0.93, 0.93);
    const lineasAviso: string[] = [];
    if (d.repartoFueraDia) {
      lineasAviso.push(
        `Entrega marcada en ${d.diaSemanaReparto ?? "este día"}, fuera de los días de reparto del proveedor` +
        (d.diasProveedor && d.diasProveedor.length ? ` (${d.diasProveedor.join(", ")}).` : "."),
      );
    }
    if (d.repartoFueraHora) {
      const horaTxt = d.horaEntrega && d.horaEntregaHasta ? `${d.horaEntrega} - ${d.horaEntregaHasta}` : (d.horaEntrega || d.horaEntregaHasta || "");
      lineasAviso.push(
        `Horario ${horaTxt} fuera de la franja de reparto` +
        (d.franjaProveedor ? ` (${d.franjaProveedor}).` : "."),
      );
    }
    if (d.repartoProveedorTexto && d.repartoProveedorTexto !== "—") {
      lineasAviso.push(`El proveedor reparte: ${d.repartoProveedorTexto}.`);
    }
    const wrapped = lineasAviso.flatMap((t) => wrap(t, font, 9, right - margin - 28));
    const boxH = 22 + wrapped.length * 12 + 6;
    page.drawRectangle({ x: margin, y: y - boxH + 14, width: right - margin, height: boxH, color: peligroBg, borderColor: peligro, borderWidth: 1.2 });
    let yy = y;
    page.drawText("AVISO: REPARTO FUERA DE LO ESTIPULADO", { x: margin + 12, y: yy, size: 9, font: bold, color: peligro });
    yy -= 14;
    for (const ln of wrapped) {
      page.drawText(ln, { x: margin + 12, y: yy, size: 9, font, color: peligro });
      yy -= 12;
    }
    y = y - boxH + 2;
  }

  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: rule });
  y -= 18;

  // Columnas: Producto | Cant | Ud | Precio U. | Total
  const colProd = margin, colCant = 320, colUd = 370, colPre = 430, colTot = right;
  const head = (txt: string, x: number, alignRight = false) =>
    page.drawText(txt, { x: alignRight ? x - bold.widthOfTextAtSize(txt, 8) : x, y, size: 8, font: bold, color: label });
  head("PRODUCTO", colProd); head("CANT.", colCant, true); head("UD", colUd);
  head("PRECIO U.", colPre, true); head("TOTAL", colTot, true);
  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 0.5, color: rule });
  y -= 14;

  const nuevaPagina = () => {
    page = pdf.addPage([W, H]);
    y = H - margin;
  };

  for (const l of d.lineas) {
    if (y < margin + 60) nuevaPagina();
    const nombre = l.producto.length > 52 ? l.producto.slice(0, 51) + "…" : l.producto;
    page.drawText(nombre, { x: colProd, y, size: 9, font, color: texto });
    const cant = String(l.cantidad);
    page.drawText(cant, { x: colCant - font.widthOfTextAtSize(cant, 9), y, size: 9, font, color: texto });
    page.drawText(l.unidad, { x: colUd, y, size: 9, font, color: texto });
    const pre = eur(l.precioUnitario);
    page.drawText(pre, { x: colPre - font.widthOfTextAtSize(pre, 9), y, size: 9, font, color: texto });
    const tot = eur(l.total);
    page.drawText(tot, { x: colTot - font.widthOfTextAtSize(tot, 9), y, size: 9, font, color: texto });
    y -= 14;
  }

  y -= 4;
  page.drawLine({ start: { x: colPre - 40, y }, end: { x: right, y }, thickness: 0.5, color: rule });
  y -= 16;
  page.drawText("TOTAL", { x: colPre - 40, y, size: 11, font: bold, color: titulo });
  const totalTxt = eur(d.total);
  page.drawText(totalTxt, { x: colTot - bold.widthOfTextAtSize(totalTxt, 11), y, size: 11, font: bold, color: titulo });
  y -= 24;

  if (d.notas && d.notas.trim()) {
    if (y < margin + 50) nuevaPagina();
    page.drawText("NOTAS", { x: margin, y, size: 8, font: bold, color: label });
    y -= 12;
    for (const ln of wrap(d.notas.trim(), font, 9, right - margin)) {
      if (y < margin + 20) nuevaPagina();
      page.drawText(ln, { x: margin, y, size: 9, font, color: texto });
      y -= 12;
    }
  }

  return pdf.save();
}

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const parrafo of text.split(/\n/)) {
    const palabras = parrafo.split(/\s+/);
    let actual = "";
    for (const w of palabras) {
      const t = actual ? `${actual} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > maxWidth) {
        if (actual) out.push(actual);
        actual = w;
      } else actual = t;
    }
    out.push(actual);
  }
  return out;
}
