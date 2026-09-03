/**
 * Cabecera de los COMUNICADOS oficiales.
 *
 * Un comunicado no es un correo de trámite: lo lee toda la plantilla y conviene
 * que entre por los ojos. Por eso lleva una cabecera con más presencia que la
 * del resto de correos (`brand-header.ts`): un degradado con el color de marca
 * de la empresa, el isotipo sobre un disco claro con sombra —el «relieve»— y el
 * título del comunicado debajo.
 *
 * Los colores salen SIEMPRE de Ajustes → Imagen de marca (`empresas.color`,
 * `color_secundario`, `color_texto`), nunca fijos: así Habana sale en su rosa y
 * Bacanal en su dorado sin tocar código.
 *
 * Compatible con clientes de correo: todo va en HTML de tablas y estilos en
 * línea. El degradado se pinta con `background-color` (color sólido de respaldo)
 * más `background-image`, que Outlook ignora sin romper nada.
 *
 * Server-only: lee de la BD con la admin client.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EmpresaMarca {
  nombre: string;
  isotipoUrl: string | null;
  logoUrl: string | null;
  color: string;
  colorSecundario: string;
  colorTexto: string;
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

/** Un color de marca vacío o mal escrito no debe pintar la cabecera de negro. */
function colorSeguro(c: string | null | undefined, porDefecto: string): string {
  const v = (c ?? "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : porDefecto;
}

/**
 * HTML de la cabecera del comunicado.
 *
 * `srcIsotipo` se pasa aparte para poder referenciar `cid:` cuando la imagen va
 * incrustada como adjunto (ver `comunicadoHeaderInline`).
 */
export function comunicadoHeaderHtml(
  marca: EmpresaMarca,
  titulo: string,
  srcIsotipo?: string,
): string {
  const color = colorSeguro(marca.color, "#1F2937");
  const color2 = colorSeguro(marca.colorSecundario, color);
  const texto = colorSeguro(marca.colorTexto, "#FFFFFF");
  const src =
    srcIsotipo ??
    (esUrlAbsoluta(marca.isotipoUrl)
      ? marca.isotipoUrl
      : esUrlAbsoluta(marca.logoUrl)
        ? marca.logoUrl
        : "");
  const alt = escapeAttr(marca.nombre || "");

  // El isotipo va sobre un disco claro: destaca sobre el degradado y le da el
  // relieve. Si la empresa no tiene imagen no se pinta el disco vacío.
  const disco = src
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px auto;">
         <tr>
           <td align="center" valign="middle" width="104" height="104" style="width:104px;height:104px;background-color:#FFFFFF;border-radius:52px;box-shadow:0 6px 18px rgba(0,0,0,0.28);">
             <img src="${escapeAttr(src)}" alt="${alt}" width="72" style="max-width:72px;max-height:72px;height:auto;width:auto;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;" />
           </td>
         </tr>
       </table>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:36px 24px 30px 24px;background-color:${color};background-image:linear-gradient(135deg, ${color} 0%, ${color2} 100%);">
      ${disco}
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${texto};opacity:0.85;margin-bottom:8px;">Comunicado oficial</div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:23px;line-height:1.3;font-weight:bold;color:${texto};text-shadow:0 2px 4px rgba(0,0,0,0.22);">${escapeAttr(titulo)}</div>
    </td>
  </tr>
  <tr>
    <td style="height:4px;background-color:${color2};font-size:0;line-height:0;">&nbsp;</td>
  </tr>
</table>`;
}

/**
 * Cabecera con el isotipo INCRUSTADO (inline CID). Gmail y Outlook bloquean las
 * imágenes externas por defecto, y un comunicado sin logo pierde la mitad de su
 * fuerza. Si la descarga falla devuelve `null` y el llamador usa la versión con
 * URL externa.
 */
export async function comunicadoHeaderInline(
  marca: EmpresaMarca,
  titulo: string,
): Promise<{
  html: string;
  attachment: { filename: string; content: Buffer; cid: string; contentType: string };
} | null> {
  const src = esUrlAbsoluta(marca.isotipoUrl)
    ? marca.isotipoUrl
    : esUrlAbsoluta(marca.logoUrl)
      ? marca.logoUrl
      : "";
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    const cid = "comunicado-marca";
    const ext = contentType.includes("svg")
      ? "svg"
      : contentType.includes("jpeg")
        ? "jpg"
        : "png";
    return {
      html: comunicadoHeaderHtml(marca, titulo, `cid:${cid}`),
      attachment: { filename: `marca.${ext}`, content: buf, cid, contentType },
    };
  } catch {
    return null;
  }
}

/** Lee la marca completa de la empresa (nombre + imágenes + colores). Nunca lanza. */
export async function fetchEmpresaMarca(empresaId: string): Promise<EmpresaMarca | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("empresas")
      .select("nombre, isotipo_url, logo_url, color, color_secundario, color_texto")
      .eq("id", empresaId)
      .maybeSingle();
    if (!data) return null;
    return {
      nombre: (data.nombre as string | null) ?? "",
      isotipoUrl: (data.isotipo_url as string | null) ?? null,
      logoUrl: (data.logo_url as string | null) ?? null,
      color: (data.color as string | null) ?? "",
      colorSecundario: (data.color_secundario as string | null) ?? "",
      colorTexto: (data.color_texto as string | null) ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Documento HTML completo del comunicado: cabecera + cuerpo sobre fondo neutro.
 * El cuerpo llega ya en HTML (lo escribe quien redacta el comunicado).
 */
export function comunicadoEmailHtml(
  cabecera: string,
  cuerpoHtml: string,
  piePersonalizado?: string,
): string {
  const pie = piePersonalizado
    ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6B7280;text-align:center;padding:0 24px 28px 24px;">${piePersonalizado}</div>`
    : "";
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:#F3F4F6;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);border-collapse:collapse;">
          <tr><td style="padding:0;">${cabecera}</td></tr>
          <tr>
            <td style="padding:28px 28px 24px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1F2937;">
              ${cuerpoHtml}
            </td>
          </tr>
          <tr><td>${pie}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
