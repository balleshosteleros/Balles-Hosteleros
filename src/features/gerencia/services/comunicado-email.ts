/**
 * Envío de un COMUNICADO por correo, con sus documentos adjuntos.
 *
 * Existe para que el comunicado salga igual lo publique una persona desde
 * Gerencia o lo publique solo el cron de los recurrentes. Antes el correo vivía
 * solo dentro del cron, así que un comunicado publicado a mano no llegaba por
 * email a nadie, y además el cron lo mandaba a la plantilla ENTERA aunque el
 * comunicado fuera para un departamento concreto.
 *
 * Los adjuntos viajan de dos formas a la vez, a propósito:
 *   · Como archivo adjunto de verdad, mientras quepan (los correos tienen un
 *     tope real de tamaño; un PDF de 40 MB rebota y el correo entero se pierde).
 *   · Como enlace al software, SIEMPRE. El enlace no caduca y el documento se
 *     abre desde la ficha del comunicado, así que aunque el archivo sea enorme
 *     el trabajador puede llegar a él.
 *
 * A quién va lo decide `comunicado-destinatarios`, la misma lista que usan la
 * campana de la app y el push del móvil: los tres avisos llegan siempre a la
 * misma gente.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolverAudienciaComunicado } from "@/features/gerencia/services/comunicado-destinatarios";
import { sendEmail } from "@/lib/email/send";
import {
  fetchEmpresaMarca,
  comunicadoHeaderInline,
  comunicadoHeaderHtml,
  comunicadoEmailHtml,
} from "@/lib/email/comunicado-header";
import { getSiteUrl } from "@/lib/site-url";
import { escapeHtml } from "@/lib/email/escape-html";
import {
  BUCKET_COMUNICADOS,
  normalizarAdjuntos,
  type ComunicadoAdjunto,
} from "@/features/gerencia/data/comunicados-adjuntos";

/**
 * Tope de lo que se manda como archivo adjunto en un mismo correo.
 *
 * No es un capricho: los servidores de correo rechazan los envíos grandes y el
 * adjunto viaja codificado, ocupando ~1,37 veces su tamaño. Con 15 MB de
 * originales el correo sale sobrado por debajo del límite habitual. Lo que no
 * quepa NO se pierde: va como enlace.
 */
const MAX_ADJUNTOS_EMAIL_BYTES = 15 * 1024 * 1024;

interface ComunicadoFila {
  id: string;
  empresa_id: string;
  titulo: string;
  cuerpo: string | null;
  estado: string;
  adjuntos: unknown;
  enlace: string | null;
  enlace_texto: string | null;
}

export interface ResultadoEnvioComunicado {
  ok: boolean;
  enviados: number;
  destinatarios: number;
  error?: string;
}

/** Texto plano de respaldo para los clientes de correo que no pintan HTML. */
function aTextoPlano(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * El cuerpo del comunicado se escribe en un campo de texto normal, no en un
 * editor de HTML: llega con saltos de línea de verdad y puede traer un «<» o un
 * «&» sueltos. Si se pegara tal cual dentro del correo, todos los párrafos se
 * juntarían en un ladrillo y un símbolo suelto podría partir el HTML. Aquí se
 * escapa y se monta en párrafos: línea en blanco = párrafo nuevo, salto suelto
 * = salto de línea. Así el correo se lee igual que en la app.
 */
function cuerpoPlanoAHtml(texto: string): string {
  const limpio = texto.replace(/\r\n?/g, "\n").trim();
  if (!limpio) return "";
  return limpio
    .split(/\n{2,}/)
    .map(
      (parrafo) =>
        `<p style="margin:0 0 16px 0;">${enlazar(escapeHtml(parrafo)).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

/**
 * Las direcciones escritas dentro del mensaje se pueden PULSAR en el correo.
 *
 * Se aplica sobre el texto YA escapado: así una dirección con `&` no rompe el
 * enlace y el resto del mensaje sigue protegido.
 */
function enlazar(htmlEscapado: string): string {
  return htmlEscapado.replace(
    /((?:https?:\/\/|www\.)[^\s<]+)/gi,
    (bruto) => {
      const m = bruto.match(/[).,;:!?»&quot;']+$/);
      const cola = m ? m[0] : "";
      const url = cola ? bruto.slice(0, bruto.length - cola.length) : bruto;
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return `<a href="${href}" style="color:#1D4ED8;text-decoration:underline;">${url}</a>${cola}`;
    },
  );
}

/**
 * Botón del enlace del comunicado.
 *
 * Va como botón y no como dirección pegada en el texto: una dirección larga
 * dentro del mensaje se lee fatal y en el móvil ni se pulsa entera.
 */
function bloqueEnlaceHtml(enlace: string | null, texto: string | null, color: string): string {
  if (!enlace) return "";
  const etiqueta = escapeHtml((texto ?? "").trim() || "Abrir enlace");
  return `<div style="margin-top:26px;text-align:center;">
    <a href="${escapeHtml(enlace)}" style="display:inline-block;background-color:${color};color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:8px;">${etiqueta}</a>
  </div>`;
}

/** Bloque HTML con los documentos: enlace al software para cada uno. */
function bloqueAdjuntosHtml(adjuntos: ComunicadoAdjunto[], color: string): string {
  if (adjuntos.length === 0) return "";
  const base = getSiteUrl().replace(/\/$/, "");
  const filas = adjuntos
    .map((a) => {
      const url = `${base}/api/comunicados/doc?path=${encodeURIComponent(a.path)}`;
      return `<tr><td style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;">
        <a href="${url}" style="color:${color};text-decoration:none;font-weight:600;">${escapeHtml(a.name)}</a>
      </td></tr>`;
    })
    .join("");
  const titulo = adjuntos.length === 1 ? "Documento adjunto" : "Documentos adjuntos";
  return `<div style="margin-top:24px;padding-top:18px;border-top:1px solid #E5E7EB;">
    <p style="margin:0 0 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;">${titulo}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${filas}</table>
  </div>`;
}

/**
 * Manda el comunicado por correo a sus destinatarios.
 *
 * No lanza: un fallo de correo nunca debe tumbar la publicación del comunicado,
 * que ya está guardada y avisada por la app.
 */
export async function enviarComunicadoPorEmail(
  comunicadoId: string,
): Promise<ResultadoEnvioComunicado> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("comunicados")
      .select("id, empresa_id, titulo, cuerpo, estado, adjuntos, enlace, enlace_texto")
      .eq("id", comunicadoId)
      .maybeSingle();
    if (error) throw error;
    const c = data as ComunicadoFila | null;
    if (!c) return { ok: false, enviados: 0, destinatarios: 0, error: "El comunicado ya no existe" };
    if (c.estado !== "publicado") {
      return { ok: false, enviados: 0, destinatarios: 0, error: "El comunicado no está publicado" };
    }

    const { emails } = await resolverAudienciaComunicado(comunicadoId);
    if (emails.length === 0) {
      return { ok: false, enviados: 0, destinatarios: 0, error: "Ningún destinatario tiene correo" };
    }

    const marca = await fetchEmpresaMarca(c.empresa_id);
    const adjuntos = normalizarAdjuntos(c.adjuntos);

    // Los archivos se descargan UNA vez y se reutilizan en todos los correos.
    const ficheros: { filename: string; content: Buffer; contentType?: string }[] = [];
    let acumulado = 0;
    for (const a of adjuntos) {
      if (acumulado + (a.size || 0) > MAX_ADJUNTOS_EMAIL_BYTES) continue;
      const { data: blob, error: errDl } = await supabase.storage
        .from(BUCKET_COMUNICADOS)
        .download(a.path);
      if (errDl || !blob) {
        console.error("[comunicado-email] adjunto no descargado:", a.path, errDl?.message);
        continue;
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      acumulado += buffer.byteLength;
      ficheros.push({
        filename: a.name,
        content: buffer,
        contentType: a.mime ?? undefined,
      });
    }

    const cuerpo = cuerpoPlanoAHtml(c.cuerpo ?? "");
    const colorEnlace = marca?.color || "#111827";
    const cuerpoConAdjuntos = `${cuerpo}${bloqueEnlaceHtml(c.enlace, c.enlace_texto, colorEnlace)}${bloqueAdjuntosHtml(adjuntos, colorEnlace)}`;

    let html: string;
    const attachments = [...ficheros];
    if (marca) {
      const inline = await comunicadoHeaderInline(marca, c.titulo);
      const cabecera = inline ? inline.html : comunicadoHeaderHtml(marca, c.titulo);
      html = comunicadoEmailHtml(cabecera, cuerpoConAdjuntos, marca.nombre);
      if (inline) attachments.push(inline.attachment);
    } else {
      html = comunicadoEmailHtml("", cuerpoConAdjuntos);
    }

    // El asunto del correo es el título del comunicado: es lo que lo identifica
    // en la bandeja igual que dentro de la app.
    const asunto = c.titulo;
    let enviados = 0;
    for (const to of emails) {
      const res = await sendEmail({
        to,
        subject: asunto,
        html,
        text: aTextoPlano(cuerpoConAdjuntos),
        fromName: marca?.nombre || undefined,
        empresaId: c.empresa_id,
        // El comunicado ya trae su propia cabecera: que no se añada la genérica.
        brandHeader: false,
        attachments,
      });
      if (res.ok) enviados++;
    }

    if (enviados > 0) {
      await supabase
        .from("comunicados")
        .update({ email_enviado_at: new Date().toISOString() })
        .eq("id", c.id);
    }

    return { ok: enviados > 0, enviados, destinatarios: emails.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicado-email] envío:", msg);
    return { ok: false, enviados: 0, destinatarios: 0, error: msg };
  }
}
