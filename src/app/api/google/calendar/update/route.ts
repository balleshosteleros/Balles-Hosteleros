import { NextResponse } from "next/server";
import { getGoogleTokens } from "@/lib/google/api";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser, getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";

/** Zona horaria de la empresa activa del usuario, para los eventos de Calendar (PRP-069). */
async function zonaEmpresaActiva(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Europe/Madrid";
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    return await getZonaHorariaEmpresa(supabase, empresaId);
  } catch {
    return "Europe/Madrid";
  }
}

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
  const tz = await zonaEmpresaActiva();

  const payload: Record<string, unknown> = {};
  if (body.titulo !== undefined) payload.summary = body.titulo;
  if (body.descripcion !== undefined) payload.description = body.descripcion;
  if (body.lugar !== undefined) payload.location = body.lugar;
  if (body.inicio)
    payload.start = { dateTime: body.inicio, timeZone: tz };
  if (body.fin) payload.end = { dateTime: body.fin, timeZone: tz };
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
