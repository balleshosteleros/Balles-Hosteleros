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
    ? "max-height:60px;max-width:60px;"
    : "max-height:52px;max-width:200px;";
  return `<div style="text-align:center;padding:24px 24px 8px 24px;"><img src="${escapeAttr(src)}" alt="${alt}" style="${sizeStyle}height:auto;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" /></div>`;
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
