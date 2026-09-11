import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Enlace para ver la(s) nómina(s) de un empleado en un mes.
 *
 * Con una sola nómina devuelve su enlace directo; con varias (nómina + finiquito,
 * por ejemplo) las une en un único PDF, una detrás de otra, y devuelve el
 * enlace de ese combinado. Lo usan tanto RRHH como el propio trabajador: la
 * nómina que abre cada uno es exactamente el mismo documento.
 */

const BUCKET = "rrhh-nominas";
const SIGNED_URL_TTL = 60 * 10; // 10 min para verla

export async function urlNominasDeMes({
  empresaId,
  empleadoId,
  periodo,
  paths,
}: {
  empresaId: string;
  empleadoId: string;
  periodo: string;
  paths: string[];
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (paths.length === 0) return { ok: false, error: "Sin nómina adjunta" };

  // Una sola: enlace directo.
  if (paths.length === 1) {
    const signed = await admin.storage.from(BUCKET).createSignedUrl(paths[0], SIGNED_URL_TTL);
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: signed.error?.message ?? "No se pudo generar el enlace" };
    }
    return { ok: true, url: signed.data.signedUrl };
  }

  // Varias: combinar los PDFs en uno (las imágenes se incrustan como página).
  const { PDFDocument } = await import("pdf-lib");
  const combinado = await PDFDocument.create();
  for (const path of paths) {
    const dl = await admin.storage.from(BUCKET).download(path);
    if (dl.error || !dl.data) continue;
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const esPdf = path.toLowerCase().endsWith(".pdf");
    try {
      if (esPdf) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pgs = await combinado.copyPages(src, src.getPageIndices());
        pgs.forEach((pg) => combinado.addPage(pg));
      } else {
        const img = path.toLowerCase().endsWith(".png")
          ? await combinado.embedPng(bytes)
          : await combinado.embedJpg(bytes);
        const page = combinado.addPage([595, 842]);
        const s = Math.min(595 / img.width, 842 / img.height);
        page.drawImage(img, {
          x: (595 - img.width * s) / 2,
          y: (842 - img.height * s) / 2,
          width: img.width * s,
          height: img.height * s,
        });
      }
    } catch (e) {
      console.error("[rrhh] combinar nómina:", path, e);
    }
  }

  const combinadoBytes = await combinado.save();
  const combinadoPath = `${empresaId}/${periodo}/${empleadoId}-combinado.pdf`;
  const up = await admin.storage
    .from(BUCKET)
    .upload(combinadoPath, Buffer.from(combinadoBytes), {
      upsert: true,
      contentType: "application/pdf",
    });
  if (up.error) return { ok: false, error: up.error.message };
  const signed = await admin.storage.from(BUCKET).createSignedUrl(combinadoPath, SIGNED_URL_TTL);
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, error: signed.error?.message ?? "No se pudo generar el enlace" };
  }
  return { ok: true, url: signed.data.signedUrl };
}
