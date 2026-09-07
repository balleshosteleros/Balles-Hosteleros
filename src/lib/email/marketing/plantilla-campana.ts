/**
 * Plantilla visual de los correos del calendario anual de campañas.
 *
 * Reutiliza el marco de los correos de Sala (`../reservas/estilo`) a propósito:
 * el cliente que reserva ya recibe su confirmación con ese marco, y la campaña
 * mensual tiene que llegar con la misma cara —mismo color de marca, mismo
 * isotipo, misma tipografía—. Si el correo comercial se viera distinto, parecería
 * de otro sitio, y un correo que no se reconoce se borra sin abrir.
 *
 * Lo que añade sobre ese marco es lo propio de una campaña: la foto grande, el
 * bloque del concurso del mes y el pie legal con el enlace de baja.
 *
 * Todo en tablas y estilo en línea: Gmail y Outlook no renderizan flexbox.
 */
import "server-only";
import {
  colorContraste,
  escapeAttr,
  escapeHtml,
  envolverEmail,
  sanitizarHex,
  withAlpha,
  type MarcaEmpresa,
} from "../reservas/estilo";

export interface CampanaEmailInput {
  empresa: MarcaEmpresa;
  /** Etiqueta pequeña sobre el titular ("31 de octubre", "San Valentín"). */
  badge: string;
  titular: string;
  subtitulo: string;
  /** Primera frase del cuerpo, en tamaño algo mayor: es la que engancha. */
  entradilla: string;
  /** Párrafos del desarrollo. Dos como mucho. */
  cuerpo: string[];
  /** Foto del mes. Si no hay, el correo sale sin hueco ni imagen rota. */
  fotoUrl?: string | null;
  /** Texto alternativo de la foto (nombre del plato). */
  fotoAlt?: string;
  ctaTexto: string;
  ctaUrl: string;
  /** Premio del concurso del mes. Vacío = el correo va sin bloque de concurso. */
  concursoPremio?: string | null;
  concursoUrl?: string | null;
  /** Enlace de baja. Obligatorio en todo correo comercial. */
  urlBaja: string;
  telefono?: string | null;
}

/** Foto ancha del mes, con las esquinas redondeadas del resto del correo. */
function bloqueFoto(url: string, alt: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px 0;">
    <tr>
      <td style="border-radius:12px;overflow:hidden;">
        <img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" width="496" style="width:100%;max-width:496px;height:auto;display:block;border:0;border-radius:12px;" />
      </td>
    </tr>
  </table>`;
}

/**
 * El gancho del mes: un día al azar sale este correo y los tres primeros que
 * acierten las cinco preguntas cenan gratis. Va en un recuadro con el color de
 * la marca para que se vea de un vistazo sin robarle el sitio al botón de
 * reservar, que es lo que de verdad llena el comedor.
 */
function bloqueConcurso(premio: string, url: string, colorMarca: string | null): string {
  const primario = sanitizarHex(colorMarca) ?? "#0f172a";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px dashed ${primario};border-radius:12px;margin-top:22px;">
    <tr>
      <td style="padding:18px 20px;text-align:center;background:${withAlpha(primario, 0.05)};">
        <div style="font-size:11px;color:${primario};letter-spacing:1px;text-transform:uppercase;font-weight:700;">Concurso del mes</div>
        <div style="margin-top:8px;font-size:15px;color:#0f172a;line-height:1.5;">
          Este correo ha salido hoy, sin avisar. Los <strong>tres primeros</strong> que acierten las cinco preguntas se llevan <strong>${escapeHtml(premio)}</strong>.
        </div>
        <div style="margin-top:6px;font-size:12px;color:#64748b;">Se responden mirando nuestra carta. No hace falta saber más.</div>
        <a href="${escapeAttr(url)}" style="display:inline-block;margin-top:14px;padding:11px 26px;border:2px solid ${primario};color:${primario};border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;">Jugar ahora</a>
      </td>
    </tr>
  </table>`;
}

/** Botón principal. El del marco de Sala, con el color de la marca. */
function bloqueCta(texto: string, url: string, colorMarca: string | null): string {
  const primario = sanitizarHex(colorMarca) ?? "#0f172a";
  const sobre = colorContraste(primario);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
    <tr>
      <td align="center">
        <a href="${escapeAttr(url)}" style="display:inline-block;padding:15px 38px;background:${primario};color:${sobre};border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(texto)}</a>
      </td>
    </tr>
  </table>`;
}

/**
 * Enlace de baja. No es una cortesía: un correo comercial sin salida visible es
 * lo que hace que la gente pulse "spam" en vez de "darme de baja", y eso sí
 * arrastra la reputación del dominio y acaba mandando también a la carpeta de
 * no deseados los correos de confirmación de reserva.
 */
function bloqueBaja(urlBaja: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
    <tr>
      <td style="padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
          Recibes este correo porque nos diste permiso para escribirte al reservar.
          <br/>
          <a href="${escapeAttr(urlBaja)}" style="color:#94a3b8;text-decoration:underline;">Darme de baja de estos correos</a>
        </p>
      </td>
    </tr>
  </table>`;
}

/** Monta el correo completo de una campaña mensual. */
export function renderCampanaEmail(input: CampanaEmailInput): string {
  const color = input.empresa.color;
  const partes: string[] = [];

  if (input.fotoUrl) partes.push(bloqueFoto(input.fotoUrl, input.fotoAlt ?? ""));

  partes.push(
    `<p style="margin:0 0 14px 0;font-size:17px;line-height:1.6;color:#0f172a;">${escapeHtml(input.entradilla)}</p>`,
  );
  for (const p of input.cuerpo) {
    partes.push(
      `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#475569;">${escapeHtml(p)}</p>`,
    );
  }

  partes.push(bloqueCta(input.ctaTexto, input.ctaUrl, color));

  if (input.concursoPremio && input.concursoUrl) {
    partes.push(bloqueConcurso(input.concursoPremio, input.concursoUrl, color));
  }

  partes.push(bloqueBaja(input.urlBaja));

  return envolverEmail({
    empresa: input.empresa,
    badge: input.badge,
    titular: input.titular,
    subtitulo: input.subtitulo,
    contenido: partes.join("\n"),
    pie: "Te esperamos.",
    telefono: input.telefono ?? null,
  });
}
