import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google/api";

type GmailListResponse = {
  messages?: { id: string; threadId: string }[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  labelIds?: string[];
  payload?: {
    headers: { name: string; value: string }[];
  };
};

function header(msg: GmailMessage, name: string): string {
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

function fechaCorta(internalDate: string): string {
  const d = new Date(parseInt(internalDate, 10));
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7)
    return d.toLocaleDateString("es-ES", { weekday: "short" });
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export async function GET(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ connected: false, mensajes: [] });
  }

  const url = new URL(request.url);
  const carpeta = url.searchParams.get("carpeta") ?? "inbox";
  // Si se pasa labelId explícito (etiqueta del usuario), tiene prioridad
  const labelIdParam = url.searchParams.get("labelId");
  const labelMap: Record<string, string> = {
    inbox: "INBOX",
    enviados: "SENT",
    borradores: "DRAFT",
    papelera: "TRASH",
  };
  const label = labelIdParam ?? labelMap[carpeta] ?? "INBOX";

  // 1) Listado de IDs
  const list = await googleFetch<GmailListResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${encodeURIComponent(label)}&maxResults=30`,
    accessToken,
  );
  if (!list || !list.messages) {
    return NextResponse.json({ connected: true, mensajes: [] });
  }

  // 2) Detalles en paralelo (metadata + snippet)
  const detalles = await Promise.all(
    list.messages.slice(0, 30).map((m) =>
      googleFetch<GmailMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        accessToken,
      ),
    ),
  );

  const mensajes = detalles
    .filter((m): m is GmailMessage => m !== null)
    .map((m) => {
      const from = parseFrom(header(m, "From"));
      return {
        id: m.id,
        remitente: from.name,
        email: from.email,
        asunto: header(m, "Subject") || "(sin asunto)",
        preview: m.snippet,
        fecha: fechaCorta(m.internalDate),
        leido: !m.labelIds?.includes("UNREAD"),
        estrella: m.labelIds?.includes("STARRED") ?? false,
        carpeta,
      };
    });

  return NextResponse.json({ connected: true, mensajes });
}
