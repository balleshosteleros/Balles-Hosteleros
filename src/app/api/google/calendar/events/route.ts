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
  _calId?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
};

const COLORS = ["blue", "emerald", "orange", "violet", "red"] as const;
type Color = (typeof COLORS)[number];

function colorFromId(colorId?: string): Color {
  if (!colorId) return "blue";
  const idx = parseInt(colorId, 10) % COLORS.length;
  return COLORS[Math.abs(idx)] || "blue";
}

function getInicioSemana(base?: Date): Date {
  const hoy = base ? new Date(base) : new Date();
  const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - dia);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export async function GET(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ connected: false, eventos: [] });
  }

  const url = new URL(request.url);
  // Permite pedir varios calendarios separados por coma
  const calendarIds =
    url.searchParams.get("calendarIds")?.split(",").filter(Boolean) ?? [
      "primary",
    ];

  // Vista (day | week | month) y fecha de referencia (yyyy-mm-dd)
  const vista = url.searchParams.get("view") ?? "week";
  const fechaRef = url.searchParams.get("date");
  const base = fechaRef ? new Date(fechaRef + "T00:00:00") : new Date();

  let inicio: Date;
  let fin: Date;

  if (vista === "day") {
    inicio = new Date(base);
    inicio.setHours(0, 0, 0, 0);
    fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 1);
  } else if (vista === "month") {
    inicio = new Date(base.getFullYear(), base.getMonth(), 1);
    fin = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  } else {
    inicio = getInicioSemana(base);
    fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 7);
  }

  const params = new URLSearchParams({
    timeMin: inicio.toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  // Pedimos los eventos de TODOS los calendarios seleccionados en paralelo
  const responses = await Promise.all(
    calendarIds.map(async (calId) => {
      const data = await googleFetch<CalendarListResponse>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`,
        accessToken,
      );
      return { calId, items: data?.items ?? [] };
    }),
  );

  // Aplanamos manteniendo el calendarId de origen
  const data: CalendarListResponse = {
    items: responses.flatMap((r) =>
      r.items.map((ev) => ({ ...ev, _calId: r.calId })),
    ) as CalendarListResponse["items"],
  };

  if (!data || !data.items) {
    return NextResponse.json({ connected: true, eventos: [] });
  }

  const eventos = data.items.map((ev) => {
    // Eventos all-day vienen con start.date (YYYY-MM-DD) en lugar de start.dateTime
    const allDay = !ev.start?.dateTime && !!ev.start?.date;

    const startStr = ev.start?.dateTime ?? `${ev.start?.date ?? ""}T00:00:00`;
    const endStr =
      ev.end?.dateTime ?? `${ev.end?.date ?? ev.start?.date ?? ""}T23:59:59`;
    const start = new Date(startStr);
    const end = new Date(endStr);

    const diaIndex = start.getDay() === 0 ? 6 : start.getDay() - 1;
    const inicioMin = allDay ? 0 : start.getHours() * 60 + start.getMinutes();
    const duracionMin = allDay
      ? 24 * 60
      : Math.max(
          15,
          Math.round((end.getTime() - start.getTime()) / 60000),
        );
    const horas = Math.floor(duracionMin / 60);
    const mins = duracionMin % 60;
    const duracion = allDay
      ? "Todo el día"
      : horas > 0
        ? `${horas}h${mins ? ` ${mins}m` : ""}`
        : `${mins}m`;

    return {
      id: ev.id,
      calendarId: ev._calId ?? "primary",
      titulo: ev.summary || "(Sin título)",
      descripcion: ev.description ?? "",
      hora: allDay
        ? "Todo el día"
        : start.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      duracion,
      lugar: ev.location,
      participantes: ev.attendees?.map((a) => a.displayName || a.email),
      color: colorFromId(ev.colorId),
      diaIndex,
      inicioMin,
      duracionMin,
      allDay,
      // Fechas ISO completas para edición y para fecha exacta
      inicio: startStr,
      fin: endStr,
      // Fecha YYYY-MM-DD para agrupar en vistas mes/día
      fechaDia: start.toISOString().slice(0, 10),
      // Link de Google Meet (si existe)
      meetLink:
        ev.hangoutLink ??
        ev.conferenceData?.entryPoints?.find(
          (ep) => ep.entryPointType === "video",
        )?.uri ??
        null,
    };
  });

  return NextResponse.json({ connected: true, eventos });
}
