import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google/api";

type CalendarListResponse = {
  items?: CalendarEvent[];
};

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string }[];
  colorId?: string;
};

const COLORS = ["blue", "emerald", "orange", "violet", "red"] as const;
type Color = (typeof COLORS)[number];

function colorFromId(colorId?: string): Color {
  if (!colorId) return "blue";
  const idx = parseInt(colorId, 10) % COLORS.length;
  return COLORS[Math.abs(idx)] || "blue";
}

function getInicioSemana(): Date {
  const hoy = new Date();
  const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - dia);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export async function GET() {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ connected: false, eventos: [] });
  }

  const inicio = getInicioSemana();
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 7);

  const params = new URLSearchParams({
    timeMin: inicio.toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const data = await googleFetch<CalendarListResponse>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    accessToken,
  );

  if (!data || !data.items) {
    return NextResponse.json({ connected: true, eventos: [] });
  }

  const eventos = data.items
    .filter((ev) => ev.start?.dateTime) // ignoramos eventos all-day
    .map((ev) => {
      const startStr = ev.start!.dateTime!;
      const endStr = ev.end?.dateTime ?? startStr;
      const start = new Date(startStr);
      const end = new Date(endStr);
      const diaIndex =
        start.getDay() === 0 ? 6 : start.getDay() - 1; // lun=0
      const inicioMin = start.getHours() * 60 + start.getMinutes();
      const duracionMin = Math.max(
        15,
        Math.round((end.getTime() - start.getTime()) / 60000),
      );
      const horas = Math.floor(duracionMin / 60);
      const mins = duracionMin % 60;
      const duracion =
        horas > 0
          ? `${horas}h${mins ? ` ${mins}m` : ""}`
          : `${mins}m`;

      return {
        id: ev.id,
        titulo: ev.summary || "(Sin título)",
        hora: start.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        duracion,
        lugar: ev.location,
        participantes: ev.attendees?.map(
          (a) => a.displayName || a.email,
        ),
        color: colorFromId(ev.colorId),
        diaIndex,
        inicioMin,
        duracionMin,
      };
    });

  return NextResponse.json({ connected: true, eventos });
}
