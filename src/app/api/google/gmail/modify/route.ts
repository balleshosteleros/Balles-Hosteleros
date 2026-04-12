import { NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/google/api";

/**
 * Modifica un mensaje de Gmail (toggle leído, estrella, archivar, papelera).
 *
 * Body: { id, action: "read" | "unread" | "star" | "unstar" | "archive" | "trash" | "untrash" }
 */
export async function POST(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ error: "no_token" }, { status: 401 });
  }

  const { id, action } = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
  };

  if (!id || !action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Mapeamos cada acción a la operación de la API
  let endpoint = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`;
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
      endpoint = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`;
      payload = {};
      break;
    case "untrash":
      endpoint = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/untrash`;
      payload = {};
      break;
    default:
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[gmail/modify]", res.status, errBody);
    return NextResponse.json(
      { error: "modify_failed", message: errBody },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
