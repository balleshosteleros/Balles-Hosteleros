import { NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/google/api";

/**
 * Modifica un mensaje de Gmail.
 *
 * Body: {
 *   id,
 *   action: "read" | "unread" | "star" | "unstar" | "archive"
 *         | "trash" | "untrash" | "delete"
 *         | "addLabel" | "removeLabel" | "moveToLabel",
 *   labelId?: string  (requerido para addLabel/removeLabel/moveToLabel)
 * }
 *
 * - "delete" borra el mensaje de forma PERMANENTE (no a papelera).
 * - "moveToLabel" añade la etiqueta indicada y saca el mensaje de INBOX.
 */
export async function POST(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ error: "no_token" }, { status: 401 });
  }

  const { id, action, labelId } = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
    labelId?: string;
  };

  if (!id || !action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const baseUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
  let endpoint = `${baseUrl}/modify`;
  let method: "POST" | "DELETE" = "POST";
  let payload: Record<string, unknown> = {};

  switch (action) {
    case "read":
      payload = { removeLabelIds: ["UNREAD"] };
      break;
    case "unread":
      payload = { addLabelIds: ["UNREAD"] };
      break;
    case "star":
      payload = { addLabelIds: ["STARRED"] };
      break;
    case "unstar":
      payload = { removeLabelIds: ["STARRED"] };
      break;
    case "archive":
      payload = { removeLabelIds: ["INBOX"] };
      break;
    case "trash":
      endpoint = `${baseUrl}/trash`;
      payload = {};
      break;
    case "untrash":
      endpoint = `${baseUrl}/untrash`;
      payload = {};
      break;
    case "delete":
      // Borrado PERMANENTE — sin papelera. Requiere scope mail.google.com/.
      endpoint = baseUrl;
      method = "DELETE";
      break;
    case "addLabel":
      if (!labelId) {
        return NextResponse.json(
          { error: "missing_labelId" },
          { status: 400 },
        );
      }
      payload = { addLabelIds: [labelId] };
      break;
    case "removeLabel":
      if (!labelId) {
        return NextResponse.json(
          { error: "missing_labelId" },
          { status: 400 },
        );
      }
      payload = { removeLabelIds: [labelId] };
      break;
    case "moveToLabel":
      if (!labelId) {
        return NextResponse.json(
          { error: "missing_labelId" },
          { status: 400 },
        );
      }
      // Mover = añadir etiqueta y sacar de la bandeja de entrada
      payload = { addLabelIds: [labelId], removeLabelIds: ["INBOX"] };
      break;
    default:
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };
  if (method === "POST") {
    init.body = JSON.stringify(payload);
  }

  const res = await fetch(endpoint, init);

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[gmail/modify]", action, res.status, errBody);
    return NextResponse.json(
      { error: "modify_failed", message: errBody, status: res.status },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
