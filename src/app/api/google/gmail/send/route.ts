import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetchAuto } from "@/lib/google/api";

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

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/**
 * Envía un email con la API de Gmail.
 *
 * Body esperado: { to, subject, body, replyTo?, threadId?, inReplyTo?, sinFirma? }
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

  const cuerpoHtml = escaparHtml(body.body ?? "");
  const firma = body.sinFirma ? "" : await leerFirmaCorporativa();
  const htmlFinal = firma
    ? `<div>${cuerpoHtml}</div><br><br><div>--<br>${firma}</div>`
    : `<div>${cuerpoHtml}</div>`;

  // Construimos el mensaje RFC 2822 en HTML
  const lines: string[] = [];
  lines.push(`From: ${email ?? "me"}`);
  lines.push(`To: ${body.to}`);
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
      { error: "send_failed", message: errBody, status: res.status },
      { status: 500 },
    );
  }

  const data = await res.json();
  return NextResponse.json({ ok: true, id: data.id });
}
