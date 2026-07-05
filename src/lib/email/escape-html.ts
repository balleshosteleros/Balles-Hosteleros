/**
 * Escapa caracteres especiales de HTML para insertar datos de forma SEGURA en el
 * cuerpo de un email (o cualquier HTML). Evita que un valor con `<`, `>`, `&`,
 * comillas… rompa el formato del correo o inyecte marcado no deseado.
 *
 * Úsalo SIEMPRE que interpoles un dato variable (nombre, DNI, email…) dentro de
 * una plantilla HTML construida a mano.
 */
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
