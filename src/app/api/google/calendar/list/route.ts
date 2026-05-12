import { NextResponse } from "next/server";
import { googleFetchAuto } from "@/lib/google/api";

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
  const r = await googleFetchAuto<CalendarListResponse>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
  );

  if (r.needsReauth) {
    return NextResponse.json(
      { connected: false, needsReauth: true, calendarios: [] },
      { status: 401 },
    );
  }

  if (!r.data || !r.data.items) {
    return NextResponse.json({ connected: true, calendarios: [] });
  }

  const calendarios = r.data.items.map((c) => ({
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
