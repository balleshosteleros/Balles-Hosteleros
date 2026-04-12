import { NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/google/api";

/**
 * Crea un evento en Google Calendar (calendario primary).
 *
 * Body: { titulo, descripcion?, lugar?, inicio (ISO), fin (ISO), invitados? }
 */
export async function POST(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ error: "no_token" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    titulo?: string;
    descripcion?: string;
    lugar?: string;
    inicio?: string;
    fin?: string;
    invitados?: string[];
    calendarId?: string;
    addMeet?: boolean;
  };

  if (!body.titulo || !body.inicio || !body.fin) {
    return NextResponse.json(
      { error: "missing_fields", message: "Falta título o fechas" },
      { status: 400 },
    );
  }
  const calId = body.calendarId || "primary";

  const payload: Record<string, unknown> = {
    summary: body.titulo,
    description: body.descripcion ?? "",
    location: body.lugar ?? "",
    start: { dateTime: body.inicio, timeZone: "Europe/Madrid" },
    end: { dateTime: body.fin, timeZone: "Europe/Madrid" },
    attendees: body.invitados?.map((email) => ({ email })) ?? [],
  };

  // Si el usuario marca "añadir Meet", pedimos a Google que genere un link
  if (body.addMeet) {
    payload.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  // conferenceDataVersion=1 es OBLIGATORIO para que Google cree el Meet
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?conferenceDataVersion=1&sendUpdates=all`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[calendar/create]", res.status, errBody);
    return NextResponse.json(
      { error: "create_failed", message: errBody },
      { status: 500 },
    );
  }

  const data = await res.json();
  return NextResponse.json({ ok: true, id: data.id });
}
