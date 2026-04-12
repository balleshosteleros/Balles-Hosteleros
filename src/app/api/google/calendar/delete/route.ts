import { NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/google/api";

/**
 * Borra un evento de Google Calendar.
 * Body: { id }
 */
export async function POST(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ error: "no_token" }, { status: 401 });
  }

  const { id, calendarId } = (await request.json().catch(() => ({}))) as {
    id?: string;
    calendarId?: string;
  };
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  const calId = calendarId || "primary";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${id}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok && res.status !== 410) {
    // 410 Gone = ya estaba borrado, lo aceptamos
    const errBody = await res.text();
    console.error("[calendar/delete]", res.status, errBody);
    return NextResponse.json(
      { error: "delete_failed", message: errBody },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
