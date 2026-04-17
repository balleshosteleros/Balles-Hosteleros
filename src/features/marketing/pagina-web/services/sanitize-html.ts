/**
 * Sanitización server-side de HTML para bloque texto_libre.
 * Usa isomorphic-dompurify; se ejecuta en Server Actions / API Routes.
 */
import DOMPurify from "isomorphic-dompurify";

const CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "a", "strong", "em", "b", "i", "u", "s",
    "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote",
    "hr",
    "span", "div",
    "img",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "class", "style"],
  ALLOW_DATA_ATTR: false,
};

export function sanitizarHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return DOMPurify.sanitize(html, CONFIG);
}

export function sanitizarBloqueTextoLibre<T extends { tipo: string; datos?: unknown }>(
  bloque: T,
): T {
  if (bloque.tipo !== "texto_libre") return bloque;
  const datos = bloque.datos as { html_seguro?: string };
  if (!datos?.html_seguro) return bloque;
  return {
    ...bloque,
    datos: { ...datos, html_seguro: sanitizarHtml(datos.html_seguro) },
  } as T;
}
