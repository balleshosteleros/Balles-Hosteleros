/**
 * Sanitización de HTML para correos (Gmail, firmas).
 *
 * Allowlist permisiva con tablas, estilos inline y tags legacy de email
 * (font, center), pero bloquea ejecución (script, iframe, on*, javascript:).
 */
import DOMPurify from "isomorphic-dompurify";

const EMAIL_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "a", "strong", "em", "b", "i", "u", "s",
    "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "hr",
    "span", "div", "section", "article",
    "img",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
    "pre", "code",
    "sub", "sup",
    "font", "small", "big", "center",
    "figure", "figcaption",
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel",
    "src", "alt", "title",
    "class", "style", "id",
    "width", "height",
    "align", "valign",
    "bgcolor", "color", "face", "size",
    "cellpadding", "cellspacing", "border",
    "colspan", "rowspan",
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|cid):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "link", "meta", "base", "style"],
  FORBID_ATTR: ["srcset"],
};

let hookInstalled = false;
function ensureHook() {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return "";
  ensureHook();
  return DOMPurify.sanitize(html, EMAIL_CONFIG);
}
