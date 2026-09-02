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
    filename?: string;
    headers: { name: string; value: string }[];
    body?: { data?: string; attachmentId?: string; size?: number };
    parts?: GmailFullMessage["payload"][];
  };
};

/** Fichero que viaja con el correo (lo que Gmail pinta como adjunto). */
type Adjunto = {
  attachmentId: string;
  nombre: string;
  mimeType: string;
  tamano: number;
  /** Content-ID: si lo tiene, la imagen va incrustada en el cuerpo (cid:). */
  contentId?: string;
  /** true = imagen del cuerpo (firma, logo), no un fichero de la lista. */
  incrustado: boolean;
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

/**
 * Recorre el árbol de partes y recoge las que son ficheros. Gmail marca un
 * adjunto con `filename` + `body.attachmentId`; las imágenes incrustadas en el
 * cuerpo (Content-ID, como los logos de una firma) también vienen con nombre,
 * así que se descartan para no llenar la lista de logotipos.
 */
function recogerAdjuntos(
  payload: GmailFullMessage["payload"],
  salida: Adjunto[] = [],
): Adjunto[] {
  if (!payload) return salida;
  const nombre = payload.filename?.trim();
  const attachmentId = payload.body?.attachmentId;
  if (nombre && attachmentId) {
    const cabecera = (name: string) =>
      payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
    // El Content-ID viene entre <> y así lo referencia el HTML: src="cid:xxx".
    const contentId = cabecera("content-id").replace(/^<|>$/g, "").trim();
    const disposition = cabecera("content-disposition").toLowerCase();
    salida.push({
      attachmentId,
      nombre,
      mimeType: payload.mimeType ?? "application/octet-stream",
      tamano: payload.body?.size ?? 0,
      contentId: contentId || undefined,
      // Gmail no lista los logos de una firma como ficheros adjuntos: los pinta
      // dentro del cuerpo. Se distinguen por el Content-ID / disposition inline.
      incrustado: Boolean(contentId) || disposition.includes("inline"),
    });
  }
  if (payload.parts) {
    for (const p of payload.parts) recogerAdjuntos(p, salida);
  }
  return salida;
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

/**
 * Cambia los `src="cid:xxx"` del cuerpo por la URL de nuestra ruta de adjuntos.
 * El navegador no sabe resolver `cid:` (apunta a una parte del propio correo),
 * así que los logos y fotos incrustadas salían como recuadros rotos.
 */
function resolverImagenesIncrustadas(
  html: string,
  messageId: string,
  adjuntos: Adjunto[],
): string {
  if (!html) return html;
  const porContentId = new Map(
    adjuntos.filter((a) => a.contentId).map((a) => [a.contentId as string, a]),
  );
  if (porContentId.size === 0) return html;

  return html.replace(
    /(src\s*=\s*)(["'])cid:([^"']+)\2/gi,
    (original, prefijo: string, comilla: string, cid: string) => {
      const limpio = decodeURIComponent(cid.trim()).replace(/^<|>$/g, "");
      const adj =
        porContentId.get(limpio) ??
        // Algunos clientes escriben el cid sin el dominio o con otra caja.
        [...porContentId.entries()].find(
          ([k]) =>
            k.toLowerCase() === limpio.toLowerCase() ||
            k.split("@")[0].toLowerCase() === limpio.split("@")[0].toLowerCase(),
        )?.[1];
      if (!adj) return original;
      const params = new URLSearchParams({
        messageId,
        attachmentId: adj.attachmentId,
        nombre: adj.nombre,
        mimeType: adj.mimeType,
      });
      return `${prefijo}${comilla}/api/google/gmail/attachment?${params.toString()}${comilla}`;
    },
  );
}

function decodificarMensaje(msg: GmailFullMessage, cuentaPropia = "") {
  const html = findPart(msg.payload, "text/html");
  const text = findPart(msg.payload, "text/plain") || findAnyBody(msg.payload);
  const from = parseFrom(header(msg, "From"));
  const adjuntos = recogerAdjuntos(msg.payload);
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
    cuerpoHtml: resolverImagenesIncrustadas(html, msg.id, adjuntos),
    // La lista de ficheros excluye las imágenes del cuerpo, igual que Gmail.
    adjuntos: adjuntos.filter((a) => !a.incrustado),
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
    adjuntos: decoded.adjuntos,
  });
}
