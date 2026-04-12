import { NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/google/api";

/**
 * Actualiza un evento existente en Google Calendar.
 *
 * Body: { id, titulo?, descripcion?, lugar?, inicio?, fin?, invitados? }
 */
export async function PATCH(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ error: "no_token" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    calendarId?: string;
    titulo?: string;
    descripcion?: string;
    lugar?: string;
    inicio?: string;
    fin?: string;
    invitados?: string[];
  };

  if (!body.id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  const calId = body.calendarId || "primary";

  const payload: Record<string, unknown> = {};
  if (body.titulo !== undefined) payload.summary = body.titulo;
  if (body.descripcion !== undefined) payload.description = body.descripcion;
  if (body.lugar !== undefined) payload.location = body.lugar;
  if (body.inicio)
    payload.start = { dateTime: body.inicio, timeZone: "Europe/Madrid" };
  if (body.fin) payload.end = { dateTime: body.fin, timeZone: "Europe/Madrid" };
  if (body.invitados)
    payload.attendees = body.invitados.map((email) => ({ email }));

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${body.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[calendar/update]", res.status, errBody);
    return NextResponse.json(
      { error: "update_failed", message: errBody },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
