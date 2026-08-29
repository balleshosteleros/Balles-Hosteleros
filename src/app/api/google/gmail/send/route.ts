import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetchAuto } from "@/lib/google/api";
import { direccionesInvalidas } from "@/features/google-workspace/lib/direcciones";

type SendAs = {
  sendAsEmail: string;
  signature?: string;
  isPrimary?: boolean;
  isDefault?: boolean;
};
type SendAsList = { sendAs?: SendAs[] };

async function leerFirmaCorporativa(): Promise<string> {
  try {
    const r = await googleFetchAuto<SendAsList>(
      "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
    );
    if (r.needsReauth) return "";
    const sendAs = r.data?.sendAs ?? [];
    const principal =
      sendAs.find((s) => s.isPrimary) ??
      sendAs.find((s) => s.isDefault) ??
      sendAs[0];
    return principal?.signature ?? "";
  } catch (err) {
    console.error("[gmail/send] no se pudo leer la firma:", err);
    return "";
  }
}

/** Ancho máximo razonable para el logo de una firma, en píxeles. */
const ANCHO_FIRMA = 320;

/**
 * Repara las imágenes de la firma antes de enviarla.
 *
 * Gmail guarda algunas firmas con un `<img>` SIN atributos `width`/`height`
 * (caso real: la firma de Habana). Muchos clientes de correo le reservan
 * entonces 0 píxeles y el logo no se ve, aunque la imagen se descargue bien —
 * mientras que otra firma con las mismas condiciones pero CON dimensiones sí
 * aparece.
 *
 * Aquí se le dan dimensiones y un `max-width` a toda imagen que no las traiga,
 * para que el logo salga visible sin tener que reconfigurar la firma en Gmail.
 * Las que ya declaran tamaño se dejan intactas: su autor ya decidió cómo se ven.
 */
function repararImagenesFirma(firma: string): string {
  if (!firma) return "";

  return firma.replace(/<img\b[^>]*>/gi, (tag) => {
    const tieneAncho = /\bwidth\s*=/i.test(tag) || /style=["'][^"']*\bwidth\s*:/i.test(tag);
    if (tieneAncho) return tag;

    // Se inyecta justo antes del cierre, respetando `<img ...>` y `<img ... />`.
    const cierre = tag.endsWith("/>") ? "/>" : ">";
    const cuerpo = tag.slice(0, tag.length - cierre.length).trimEnd();
    return `${cuerpo} width="${ANCHO_FIRMA}" style="max-width:${ANCHO_FIRMA}px;height:auto;display:block"${cierre}`;
  });
}

/**
 * Convierte el texto del compositor en HTML seguro y CLICABLE.
 *
 * Se escapa primero (para no inyectar HTML) y solo después se detectan las URLs
 * y correos sobre el texto ya escapado: así un enlace pegado en el mensaje llega
 * como enlace de verdad y no como texto plano.
 *
 * El orden importa: si se enlazara antes de escapar, el `<a>` recién creado se
 * escaparía a sí mismo y se vería el marcado en el correo.
 */
function escaparHtml(texto: string): string {
  const escapado = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const enlazado = escapado
    // URLs http(s) y www. Se corta en el signo de puntuación final para no
    // tragarse el punto o la coma que cierran la frase.
    .replace(
      /\b(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,
      (url) => {
        const limpia = url.replace(/[.,;:!?)\]]+$/, "");
        const cola = url.slice(limpia.length);
        const href = limpia.startsWith("http") ? limpia : `https://${limpia}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8;text-decoration:underline">${limpia}</a>${cola}`;
      },
    )
    // Correos sueltos → mailto. Se excluyen los que ya van dentro de un href.
    .replace(
      /(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
      (_m, previo: string, correo: string) =>
        `${previo}<a href="mailto:${correo}" style="color:#1a73e8;text-decoration:underline">${correo}</a>`,
    );

  return enlazado.replace(/\n/g, "<br>");
}

/**
 * Traduce el error de la API de Gmail a algo accionable.
 *
 * Google devuelve un JSON crudo tipo `{"error":{"code":400,...,"reason":
 * "invalidArgument"}}` que en pantalla no dice nada. Aquí se convierte en una
 * frase que explica QUÉ pasó y QUÉ hacer.
 */
function mensajeErrorGmail(status: number, cuerpo: string, destino?: string): string {
  let razon = "";
  let detalle = "";
  try {
    const j = JSON.parse(cuerpo) as {
      error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    };
    razon = j.error?.errors?.[0]?.reason ?? "";
    detalle = j.error?.errors?.[0]?.message ?? j.error?.message ?? "";
  } catch {
    detalle = cuerpo.slice(0, 200);
  }

  const malas = destino ? direccionesInvalidas(destino) : [];
  if (malas.length > 0) {
    return `La dirección "${malas[0]}" no es válida. Revisa que esté bien escrita (por ejemplo, que el dominio lleve el punto: gmail.com).`;
  }

  if (/invalid.*to header/i.test(detalle) || razon === "invalidArgument") {
    return "Gmail ha rechazado el destinatario. Revisa que la dirección esté bien escrita, sin espacios ni comas de más.";
  }
  if (status === 401 || status === 403) {
    return "Google ha rechazado el envío por permisos. Vuelve a conectar tu cuenta desde Ajustes.";
  }
  if (status === 429) {
    return "Google ha limitado el envío por exceso de correos. Espera unos minutos y vuelve a intentarlo.";
  }
  if (status >= 500) {
    return "Gmail no está disponible en este momento. Inténtalo de nuevo en unos minutos.";
  }
  return detalle
    ? `Gmail ha rechazado el envío: ${detalle}`
    : "No se pudo enviar el correo. Revisa el destinatario y vuelve a intentarlo.";
}

/**
 * Envía un email con la API de Gmail.
 *
 * Body esperado: { to, subject, body, cc?, bcc?, replyTo?, threadId?, inReplyTo?, sinFirma? }
 * Construye un mensaje RFC2822 en HTML, añade la firma corporativa configurada
 * en Gmail (a menos que `sinFirma=true`) y lo codifica en base64url.
 */
export async function POST(request: Request) {
  const { accessToken, email } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json(
      { error: "no_token", message: "Conecta tu cuenta de Google primero" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    replyTo?: string;
    threadId?: string;
    inReplyTo?: string;
    sinFirma?: boolean;
  };

  if (!body.to || !body.subject) {
    return NextResponse.json(
      { error: "missing_fields", message: "Falta destinatario o asunto" },
      { status: 400 },
    );
  }

  // Se valida ANTES de llamar a Gmail: así el aviso dice qué dirección falla en
  // vez de devolver el JSON crudo que responde Google. Las copias entran en la
  // misma comprobación: Gmail rechaza el envío completo por una sola dirección
  // mal escrita, esté en "Para", en "Cc" o en "Cco".
  const todasLasDirecciones = [body.to, body.cc, body.bcc]
    .filter((c): c is string => !!c && c.trim().length > 0)
    .join(",");
  const malas = direccionesInvalidas(todasLasDirecciones);
  if (malas.length > 0) {
    return NextResponse.json(
      {
        error: "invalid_recipient",
        message: `La dirección "${malas[0]}" no es válida. Revisa que esté bien escrita (por ejemplo, que el dominio lleve el punto: gmail.com).`,
      },
      { status: 400 },
    );
  }

  const cuerpoHtml = escaparHtml(body.body ?? "");
  const firma = body.sinFirma ? "" : repararImagenesFirma(await leerFirmaCorporativa());
  const htmlFinal = firma
    ? `<div>${cuerpoHtml}</div><br><br><div>--<br>${firma}</div>`
    : `<div>${cuerpoHtml}</div>`;

  // Construimos el mensaje RFC 2822 en HTML
  const lines: string[] = [];
  lines.push(`From: ${email ?? "me"}`);
  lines.push(`To: ${body.to}`);
  // Copia visible: va en la cabecera y todos los destinatarios la ven.
  if (body.cc?.trim()) lines.push(`Cc: ${body.cc.trim()}`);
  // COPIA OCULTA. Gmail hace exactamente esto: la cabecera `Bcc` viaja en el
  // mensaje que se le entrega a la API, el servidor la usa para repartir y la
  // BORRA antes de entregar cada copia. Así nadie —tampoco quien está en Cco—
  // ve al resto de direcciones ocultas.
  if (body.bcc?.trim()) lines.push(`Bcc: ${body.bcc.trim()}`);
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(body.subject).toString("base64")}?=`);
  if (body.replyTo) lines.push(`Reply-To: ${body.replyTo}`);
  if (body.inReplyTo) {
    lines.push(`In-Reply-To: ${body.inReplyTo}`);
    lines.push(`References: ${body.inReplyTo}`);
  }
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(htmlFinal);

  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const payload: { raw: string; threadId?: string } = { raw };
  if (body.threadId) payload.threadId = body.threadId;

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[gmail/send]", res.status, errBody);
    return NextResponse.json(
      {
        error: "send_failed",
        message: mensajeErrorGmail(res.status, errBody, todasLasDirecciones),
        status: res.status,
      },
      { status: 500 },
    );
  }

  const data = await res.json();
  return NextResponse.json({ ok: true, id: data.id });
}
