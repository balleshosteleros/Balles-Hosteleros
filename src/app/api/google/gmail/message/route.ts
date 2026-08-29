import { NextResponse } from "next/server";
import { googleFetchAuto, getGoogleTokens } from "@/lib/google/api";

type GmailFullMessage = {
  id: string;
  threadId?: string;
  snippet: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: {
    mimeType?: string;
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailFullMessage["payload"][];
  };
};

type GmailFullThread = {
  id: string;
  messages?: GmailFullMessage[];
};

function decodeBody(b64?: string): string {
  if (!b64) return "";
  try {
    const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(norm, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function findPart(
  payload: GmailFullMessage["payload"],
  mimeType: string,
): string {
  if (!payload) return "";
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = findPart(p, mimeType);
      if (t) return t;
    }
  }
  return "";
}

function findAnyBody(payload: GmailFullMessage["payload"]): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBody(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = findAnyBody(p);
      if (t) return t;
    }
  }
  return "";
}

function header(msg: GmailFullMessage, name: string): string {
  return (
    msg.payload?.headers?.find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? ""
  );
}

function parseFrom(value: string): { name: string; email: string } {
  const m = value.match(/^(.*?)\s*<(.+)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim(), email: m[2] };
  return { name: value, email: value };
}

function fechaLarga(internalDate?: string): string {
  if (!internalDate) return "";
  const d = new Date(parseInt(internalDate, 10));
  // Hora real en España; sin timeZone saldría en UTC del servidor (PRP-069).
  return d.toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Nombre del remitente tal y como lo escribe Gmail: si el mensaje lo mandaste
 * tú, pone "yo"; si el contacto no tiene nombre guardado, la parte anterior a
 * la arroba en vez de la dirección completa.
 */
function nombreRemitente(
  from: { name: string; email: string },
  cuentaPropia: string,
): string {
  if (cuentaPropia && from.email.toLowerCase() === cuentaPropia.toLowerCase()) {
    return "yo";
  }
  const limpio = from.name.trim();
  return limpio && limpio.toLowerCase() !== from.email.toLowerCase()
    ? limpio
    : from.email.split("@")[0];
}

function decodificarMensaje(msg: GmailFullMessage, cuentaPropia = "") {
  const html = findPart(msg.payload, "text/html");
  const text = findPart(msg.payload, "text/plain") || findAnyBody(msg.payload);
  const from = parseFrom(header(msg, "From"));
  return {
    id: msg.id,
    threadId: msg.threadId,
    remitente: nombreRemitente(from, cuentaPropia),
    email: from.email,
    fecha: fechaLarga(msg.internalDate),
    asunto: header(msg, "Subject"),
    leido: !msg.labelIds?.includes("UNREAD"),
    estrella: msg.labelIds?.includes("STARRED") ?? false,
    cuerpo: text || msg.snippet,
    cuerpoHtml: html,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const threadId = url.searchParams.get("threadId");
  const { email: cuentaPropia } = await getGoogleTokens();

  // Hilo completo: devolver todos los mensajes (como Gmail)
  if (threadId) {
    const r = await googleFetchAuto<GmailFullThread>(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    );
    if (r.needsReauth) {
      return NextResponse.json({ connected: false, mensajes: [] });
    }
    const thread = r.data;
    if (!thread || !thread.messages) {
      return NextResponse.json({ connected: true, mensajes: [] });
    }
    const mensajes = thread.messages.map((m) =>
      decodificarMensaje(m, cuentaPropia ?? ""),
    );
    return NextResponse.json({ connected: true, mensajes });
  }

  if (!id) {
    return NextResponse.json({ error: "missing id or threadId" }, { status: 400 });
  }

  const r = await googleFetchAuto<GmailFullMessage>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
  );
  if (r.needsReauth) {
    return NextResponse.json({ connected: false, cuerpo: "", cuerpoHtml: "" });
  }
  const msg = r.data;
  if (!msg) {
    return NextResponse.json({ connected: true, cuerpo: "", cuerpoHtml: "" });
  }

  const decoded = decodificarMensaje(msg, cuentaPropia ?? "");
  return NextResponse.json({
    connected: true,
    cuerpo: decoded.cuerpo,
    cuerpoHtml: decoded.cuerpoHtml,
  });
}
