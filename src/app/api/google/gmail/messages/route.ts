import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google/api";

type GmailThreadListResponse = {
  threads?: { id: string; historyId: string }[];
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

type GmailThreadResponse = {
  id: string;
  messages?: GmailMessage[];
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

function quitarPrefijoRe(asunto: string): string {
  return asunto.replace(/^\s*(re|fwd|rv|ref)\s*:\s*/i, "").trim();
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

  // 1) Listado de hilos (conversaciones), igual que Gmail web
  const list = await googleFetch<GmailThreadListResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?labelIds=${encodeURIComponent(label)}&maxResults=30`,
    accessToken,
  );
  if (!list || !list.threads) {
    return NextResponse.json({ connected: true, mensajes: [] });
  }

  // 2) Detalles de cada hilo en paralelo (todos sus mensajes en metadata)
  const detalles = await Promise.all(
    list.threads.slice(0, 30).map((t) =>
      googleFetch<GmailThreadResponse>(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        accessToken,
      ),
    ),
  );

  const mensajes = detalles
    .filter(
      (t): t is GmailThreadResponse =>
        t !== null && Array.isArray(t.messages) && t.messages.length > 0,
    )
    .map((t) => {
      const msgs = t.messages!;
      const ultimoMsg = msgs[msgs.length - 1];
      const primerMsg = msgs[0];
      const fromUltimo = parseFrom(header(ultimoMsg, "From"));

      // Estado agregado del hilo (Gmail considera el hilo no leído si CUALQUIER
      // mensaje lo está; idem con la estrella). También unimos todas las labels
      // para que las etiquetas del usuario se vean.
      const todosLabels = new Set<string>();
      let algunoNoLeido = false;
      let algunoEstrella = false;
      for (const m of msgs) {
        m.labelIds?.forEach((l) => todosLabels.add(l));
        if (m.labelIds?.includes("UNREAD")) algunoNoLeido = true;
        if (m.labelIds?.includes("STARRED")) algunoEstrella = true;
      }

      const asuntoBase =
        header(primerMsg, "Subject") || header(ultimoMsg, "Subject") || "";
      // Gmail muestra el asunto del primer mensaje sin "Re:"
      const asunto = quitarPrefijoRe(asuntoBase) || "(sin asunto)";

      return {
        id: ultimoMsg.id,
        threadId: t.id,
        remitente: fromUltimo.name,
        email: fromUltimo.email,
        asunto,
        preview: ultimoMsg.snippet,
        fecha: fechaCorta(ultimoMsg.internalDate),
        leido: !algunoNoLeido,
        estrella: algunoEstrella,
        carpeta,
        labelIds: Array.from(todosLabels),
        mensajesCount: msgs.length,
      };
    });

  return NextResponse.json({ connected: true, mensajes });
}
