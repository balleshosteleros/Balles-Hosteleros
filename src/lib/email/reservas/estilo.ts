/**
 * Piezas visuales compartidas de los correos del módulo de Sala.
 *
 * Viven aquí para que el correo de una reserva y el de una compra de Ticket se
 * vean exactamente igual: mismo color de marca, misma tipografía, mismas
 * tarjetas. Si se cambia el estilo, se cambia en un solo sitio.
 *
 * Todo se escribe con tablas y estilos en línea porque Outlook y Gmail no
 * renderizan de forma fiable flexbox, grid ni hojas de estilo externas.
 */
import "server-only";

export const AVISO_NO_REPLY =
  "Este mensaje se ha enviado desde una dirección que no admite respuestas: los correos que se envíen aquí no se reciben ni se leen.";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function nl2br(s: string): string {
  return s.replace(/\n/g, "<br/>");
}

/** 98 → "98,00" (coma decimal, como en toda la aplicación). */
export function formatearImporte(eur: number): string {
  return eur.toFixed(2).replace(/\./, ",");
}

export function formatearFecha(iso: string): string {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function primerNombre(s: string | null | undefined): string {
  if (!s) return "";
  return s.split(" ")[0] || "";
}

export function sustituir(plantilla: string, vars: Record<string, string>): string {
  return plantilla.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? "");
}

export function sanitizarHex(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function oscurecerHex(hex: string, ratio: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.max(0, Math.round(c * (1 - ratio)));
  const out = (mix(r) << 16) | (mix(g) << 8) | mix(b);
  return `#${out.toString(16).padStart(6, "0")}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Blanco o casi negro, el que se lea mejor sobre ese fondo. */
export function colorContraste(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#0f172a" : "#ffffff";
}

/** Fila etiqueta/valor de las tarjetas de datos. */
export function fila(etiqueta: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;color:#64748b;width:42%;">${etiqueta}</td>
    <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;text-align:right;">${escapeHtml(valor)}</td>
  </tr>`;
}

/**
 * Identidad visual de la empresa en los correos. Sin teléfono ni correo de
 * contacto a propósito: estos envíos salen de un buzón que nadie lee, y la vía
 * de vuelta es siempre el enlace de gestión que lleva el propio correo.
 */
export interface MarcaEmpresa {
  nombre: string;
  logo_url: string | null;
  isotipo_url: string | null;
  color: string | null;
  /** Segundo color de Imagen de marca. Si falta, se deriva del primario. */
  color_secundario?: string | null;
}

export interface EnvolturaInput {
  empresa: MarcaEmpresa;
  /** Etiqueta pequeña de la cabecera (ej. "Compra confirmada"). */
  badge: string;
  /**
   * Pinta el distintivo en rojo en vez de en el color de marca. Para los
   * correos que traen una mala noticia —cancelada, no presentado—: con el
   * dorado de la casa se leían igual que una confirmación, y el cliente no
   * distinguía de un vistazo que su mesa ya no está.
   */
  badgeAviso?: boolean;
  /** Titular grande. */
  titular: string;
  /** Línea bajo el titular. */
  subtitulo: string;
  /** Cuerpo ya montado. */
  contenido: string;
  /** Línea del pie, antes del nombre de la empresa. Texto plano. */
  pie: string;
  /**
   * Teléfono del restaurante (Ajustes → Empresa). Va junto al aviso de que el
   * buzón no admite respuestas: si el cliente necesita algo que el correo no
   * resuelve —cambiar la hora, avisar de una alergia— tiene que poder
   * llamar. Sin él, el aviso solo dice "no me escribas" y deja al cliente sin
   * salida.
   */
  telefono?: string | null;
}

/**
 * Envuelve un contenido con la cabecera de marca, el badge, el titular y el
 * pie. Es el marco común de todos los correos de Sala.
 */
export function envolverEmail(input: EnvolturaInput): string {
  const primario = sanitizarHex(input.empresa.color) ?? "#0f172a";
  // El segundo color de la marca manda; si no está configurado, se oscurece el
  // primario para que el degradado tenga profundidad igualmente.
  const primarioOscuro =
    sanitizarHex(input.empresa.color_secundario) ?? oscurecerHex(primario, 0.15);
  const textoSobrePrimario = colorContraste(primario);
  const empresaNombre = input.empresa.nombre || "";

  const marcaSrc = input.empresa.isotipo_url || input.empresa.logo_url;
  const cabeceraHtml = marcaSrc
    ? `<img src="${escapeAttr(marcaSrc)}" alt="${escapeAttr(empresaNombre)}" style="max-height:60px;max-width:220px;display:block;margin:0 auto;" />`
    : `<div style="font-size:22px;font-weight:700;color:${textoSobrePrimario};letter-spacing:0.2px;">${escapeHtml(empresaNombre)}</div>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
            <tr>
              <td align="center" style="padding:28px 32px;background:linear-gradient(135deg, ${primario} 0%, ${primarioOscuro} 100%);">
                ${cabeceraHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px 32px;text-align:center;">
                <div style="display:inline-block;padding:4px 12px;background:${input.badgeAviso ? "#FBE9E7" : withAlpha(primario, 0.1)};color:${input.badgeAviso ? "#B3261E" : primario};border-radius:9999px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${escapeHtml(input.badge)}</div>
                <h1 style="margin:14px 0 4px 0;font-size:26px;font-weight:700;color:#0f172a;line-height:1.25;">${escapeHtml(input.titular)}</h1>
                <p style="margin:0;font-size:13px;color:#64748b;">${escapeHtml(input.subtitulo)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                ${input.contenido}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
                  ${escapeHtml(input.pie)}
                  ${empresaNombre ? `<br/><strong style="color:#475569;">${escapeHtml(empresaNombre)}</strong>` : ""}
                </p>
                <p style="margin:10px 0 0 0;font-size:11px;color:#cbd5e1;line-height:1.5;text-align:center;">
                  ${AVISO_NO_REPLY}${
                    input.telefono
                      ? ` Si necesitas algo, llámanos al <a href="tel:${escapeAttr(
                          input.telefono.replace(/\s+/g, ""),
                        )}" style="color:#94a3b8;text-decoration:none;font-weight:600;">${escapeHtml(
                          input.telefono,
                        )}</a>.`
                      : ""
                  }
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Tarjeta del código promocional. Es lo más importante del correo de compra,
 * así que se pinta grande, monoespaciado y con mucho aire: tiene que poder
 * leerse de un vistazo en el móvil y dictarse por teléfono sin errores.
 */
export function tarjetaCodigo(codigo: string, colorMarca: string | null): string {
  const primario = sanitizarHex(colorMarca) ?? "#0f172a";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:2px solid ${primario};border-radius:12px;margin-top:14px;">
    <tr>
      <td style="padding:20px;text-align:center;background:${withAlpha(primario, 0.04)};">
        <div style="font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Tu código</div>
        <div style="margin-top:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;color:${primario};letter-spacing:8px;line-height:1;">${escapeHtml(codigo)}</div>
        <div style="margin-top:10px;font-size:12px;color:#94a3b8;">Válido para un solo uso</div>
      </td>
    </tr>
  </table>`;
}

/** Botón principal de acción. */
export function boton(texto: string, url: string, colorMarca: string | null): string {
  const primario = sanitizarHex(colorMarca) ?? "#0f172a";
  const sobre = colorContraste(primario);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
    <tr>
      <td align="center">
        <a href="${escapeAttr(url)}" style="display:inline-block;padding:13px 30px;background:${primario};color:${sobre};border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(texto)}</a>
      </td>
    </tr>
  </table>`;
}
