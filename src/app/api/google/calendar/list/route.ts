import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google/api";

type CalendarListResponse = {
  items?: GoogleCalendar[];
};

type GoogleCalendar = {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  selected?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
};

export async function GET() {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ connected: false, calendarios: [] });
  }

  const data = await googleFetch<CalendarListResponse>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    accessToken,
  );

  if (!data || !data.items) {
    return NextResponse.json({ connected: true, calendarios: [] });
  }

  const calendarios = data.items.map((c) => ({
    id: c.id,
    nombre: c.summary,
    descripcion: c.description,
    primary: c.primary ?? false,
    color: c.backgroundColor ?? "#3B82F6",
    colorTexto: c.foregroundColor ?? "#ffffff",
    rol: c.accessRole ?? "reader",
    seleccionado: c.selected ?? c.primary ?? false,
  }));

  // Primary primero, luego ordenados por nombre
  calendarios.sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return NextResponse.json({ connected: true, calendarios });
}
