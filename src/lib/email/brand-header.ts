/**
 * Cabecera corporativa común de los correos del software.
 *
 * Antepone el ISOTIPO (icono de marca) de la empresa a la parte superior del
 * email para darle un aspecto más corporativo y reconocible. Si la empresa no
 * tiene isotipo, cae al logo completo; si no tiene ninguno, no se añade nada
 * (nunca un hueco/imagen rota).
 *
 * La cabecera la inyecta `sendEmail` cuando se le pasa `empresaId`. Los correos
 * que ya construyen su propia cabecera de marca pasan `brandHeader: false`.
 *
 * Server-only: lee de la BD con la admin client.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EmpresaBrand {
  nombre: string;
  isotipoUrl: string | null;
  logoUrl: string | null;
}

/** Solo las URLs absolutas https funcionan en los clientes de correo. */
function esUrlAbsoluta(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u.trim());
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML de la cabecera: el isotipo de la empresa centrado. Prefiere el isotipo
 * (icono cuadrado); si no hay, usa el logo. Devuelve "" si no hay imagen válida.
 */
export function brandHeaderHtml(brand: EmpresaBrand): string {
  const isIsotipo = esUrlAbsoluta(brand.isotipoUrl);
  const src = isIsotipo
    ? brand.isotipoUrl
    : esUrlAbsoluta(brand.logoUrl)
      ? brand.logoUrl
      : "";
  if (!src) return "";
  const alt = escapeAttr(brand.nombre || "");
  // Isotipo → icono cuadrado contenido; logo (fallback) → algo más ancho.
  const sizeStyle = isIsotipo
    ? "max-height:110px;max-width:110px;"
    : "max-height:88px;max-width:300px;";
  return `<div style="text-align:center;padding:32px 24px 12px 24px;"><img src="${escapeAttr(src)}" alt="${alt}" style="${sizeStyle}height:auto;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" /></div>`;
}

/**
 * Cabecera con la imagen INCRUSTADA (inline CID): devuelve el HTML que apunta a
 * `cid:<id>` y el adjunto inline a añadir al correo. Así Gmail/Outlook muestran
 * el logo AUTOMÁTICAMENTE, sin pedir «mostrar imágenes». Si la descarga falla,
 * devuelve `null` y el llamador usa la versión con URL externa (fallback).
 */
export async function brandHeaderInline(
  brand: EmpresaBrand,
): Promise<{ html: string; attachment: { filename: string; content: Buffer; cid: string; contentType: string } } | null> {
  const isIsotipo = esUrlAbsoluta(brand.isotipoUrl);
  const src = isIsotipo ? brand.isotipoUrl : esUrlAbsoluta(brand.logoUrl) ? brand.logoUrl : "";
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    const cid = "marca-empresa-logo";
    const alt = escapeAttr(brand.nombre || "");
    const sizeStyle = isIsotipo ? "max-height:110px;max-width:110px;" : "max-height:88px;max-width:300px;";
    const ext = contentType.includes("svg") ? "svg" : contentType.includes("jpeg") ? "jpg" : "png";
    const html = `<div style="text-align:center;padding:32px 24px 12px 24px;"><img src="cid:${cid}" alt="${alt}" style="${sizeStyle}height:auto;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" /></div>`;
    return { html, attachment: { filename: `logo.${ext}`, content: buf, cid, contentType } };
  } catch {
    return null;
  }
}

/**
 * INCRUSTA la marca que el propio HTML ya trae. Los correos que pintan su propia
 * cabecera (reservas) referencian el isotipo por URL externa, y Gmail/Outlook
 * BLOQUEAN esas imágenes por defecto: el cliente ve un hueco donde debería estar
 * el logo. Aquí sustituimos esas URLs por `cid:` y devolvemos el adjunto inline,
 * de modo que la imagen se ve SIEMPRE, sin pedir «mostrar imágenes».
 *
 * Solo toca las URLs de marca de ESA empresa (isotipo/logo): el resto del HTML
 * se deja intacto. Best-effort: si la descarga falla, devuelve el html tal cual.
 */
export async function incrustarMarcaEnHtml(
  html: string,
  brand: EmpresaBrand,
): Promise<{
  html: string;
  attachments: { filename: string; content: Buffer; cid: string; contentType: string }[];
}> {
  const attachments: { filename: string; content: Buffer; cid: string; contentType: string }[] = [];
  // Candidatas: las imágenes de marca de la empresa que aparezcan en el HTML.
  const candidatas = [brand.isotipoUrl, brand.logoUrl].filter(esUrlAbsoluta);
  let out = html;
  for (const [i, url] of candidatas.entries()) {
    if (!out.includes(url)) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/png";
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) continue;
      const cid = `marca-empresa-${i}`;
      const ext = contentType.includes("svg") ? "svg" : contentType.includes("jpeg") ? "jpg" : "png";
      // `split/join` = reemplazo literal de TODAS las apariciones, sin que los
      // caracteres de la URL se interpreten como patrón de expresión regular.
      out = out.split(url).join(`cid:${cid}`);
      attachments.push({ filename: `marca-${i}.${ext}`, content: buf, cid, contentType });
    } catch {
      // Se queda la URL externa (comportamiento anterior): nunca rompe el envío.
    }
  }
  return { html: out, attachments };
}

/** Lee marca de la empresa (nombre + isotipo + logo). Nunca lanza. */
export async function fetchEmpresaBrand(empresaId: string): Promise<EmpresaBrand | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("empresas")
      .select("nombre, isotipo_url, logo_url")
      .eq("id", empresaId)
      .maybeSingle();
    if (!data) return null;
    return {
      nombre: (data.nombre as string | null) ?? "",
      isotipoUrl: (data.isotipo_url as string | null) ?? null,
      logoUrl: (data.logo_url as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Inserta la cabecera justo después de `<body…>` (documentos completos) o al
 * principio (fragmentos HTML), de modo que el isotipo quede arriba del todo.
 */
export function inyectarCabecera(html: string, header: string): string {
  if (!header) return html;
  const m = html.match(/<body[^>]*>/i);
  if (m) {
    const idx = html.indexOf(m[0]) + m[0].length;
    return html.slice(0, idx) + header + html.slice(idx);
  }
  return header + html;
}
