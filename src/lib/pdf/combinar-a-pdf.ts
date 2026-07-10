import "server-only";

/**
 * Combina hasta N ficheros (PDF o imagen JPG/PNG) en UN ÚNICO PDF.
 *
 * · PDF  → se copian todas sus páginas.
 * · JPG/PNG → una página A4 por imagen, centrada y escalada.
 *
 * pdf-lib solo incrusta JPG y PNG de forma nativa. Los formatos que no puede
 * incrustar (p. ej. WebP/HEIC de algunos móviles) se OMITEN del PDF pero se
 * informan en `omitidos` para que el llamador decida (p. ej. avisar al usuario).
 * Nunca lanza por un fichero suelto: uno malo no tumba la fusión de los demás.
 */

export interface FicheroParaCombinar {
  nombre: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface CombinarResultado {
  pdf: Uint8Array;
  /** Nº de ficheros efectivamente incluidos en el PDF. */
  incluidos: number;
  /** Nombres de ficheros que no se pudieron incrustar (formato no soportado). */
  omitidos: string[];
}

const A4_ANCHO = 595;
const A4_ALTO = 842;

export async function combinarFicherosEnPdf(
  ficheros: FicheroParaCombinar[],
): Promise<CombinarResultado> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const omitidos: string[] = [];
  let incluidos = 0;

  for (const f of ficheros) {
    const tipo = (f.contentType || "").toLowerCase();
    const nombre = (f.nombre || "").toLowerCase();
    const esPdf = tipo.includes("pdf") || nombre.endsWith(".pdf");
    const esPng = tipo.includes("png") || nombre.endsWith(".png");
    const esJpg =
      tipo.includes("jpeg") ||
      tipo.includes("jpg") ||
      nombre.endsWith(".jpg") ||
      nombre.endsWith(".jpeg");

    try {
      if (esPdf) {
        const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        const pgs = await doc.copyPages(src, src.getPageIndices());
        pgs.forEach((pg) => doc.addPage(pg));
        incluidos++;
      } else if (esPng || esJpg) {
        const img = esPng ? await doc.embedPng(f.bytes) : await doc.embedJpg(f.bytes);
        const page = doc.addPage([A4_ANCHO, A4_ALTO]);
        const s = Math.min(A4_ANCHO / img.width, A4_ALTO / img.height);
        page.drawImage(img, {
          x: (A4_ANCHO - img.width * s) / 2,
          y: (A4_ALTO - img.height * s) / 2,
          width: img.width * s,
          height: img.height * s,
        });
        incluidos++;
      } else {
        // Formato que pdf-lib no incrusta (WebP/HEIC…): se omite del PDF.
        omitidos.push(f.nombre);
      }
    } catch (e) {
      console.error("[pdf] combinarFicherosEnPdf:", f.nombre, e);
      omitidos.push(f.nombre);
    }
  }

  const pdf = await doc.save();
  return { pdf, incluidos, omitidos };
}
