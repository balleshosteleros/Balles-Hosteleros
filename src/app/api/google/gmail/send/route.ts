import { NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/google/api";

/**
 * Envía un email con la API de Gmail.
 *
 * Body esperado: { to, subject, body, replyTo?, threadId? }
 * Construye un mensaje RFC2822 y lo codifica en base64url para Gmail.
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
  };

  if (!body.to || !body.subject) {
    return NextResponse.json(
      { error: "missing_fields", message: "Falta destinatario o asunto" },
      { status: 400 },
    );
  }

  // Construimos el mensaje RFC 2822
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
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(body.body ?? "");

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
