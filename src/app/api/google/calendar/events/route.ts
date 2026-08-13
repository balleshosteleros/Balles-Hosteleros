import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetchAuto } from "@/lib/google/api";
import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
import {
  claveDiaEnZona,
  formatHoraEnZona,
  hoyEnZona,
  minutosDiaEnZona,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";

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
  attendees?: {
    email: string;
    displayName?: string;
    self?: boolean;
    responseStatus?: string;
  }[];
  colorId?: string;
  _calId?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
};

type UserCalendarListItem = {
  id: string;
  selected?: boolean;
  primary?: boolean;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  foregroundColor?: string;
};

type UserCalendarList = {
  items?: UserCalendarListItem[];
};

const COLORS = ["blue", "emerald", "orange", "violet", "red"] as const;
type Color = (typeof COLORS)[number];

function colorFromId(colorId?: string): Color {
  if (!colorId) return "blue";
  const idx = parseInt(colorId, 10) % COLORS.length;
  return COLORS[Math.abs(idx)] || "blue";
}

function findMeetUrlIn(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
  return m ? m[0] : null;
}

// Paleta oficial de Google para eventos cuando tienen colorId (override).
// Si el evento NO tiene colorId, hereda el color del calendario al que
// pertenece, que el frontend conoce por la lista que carga en la sidebar.
// https://developers.google.com/calendar/api/v3/reference/colors
const GOOGLE_EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
};

/** Zona horaria de la empresa activa del usuario (PRP-069). */
async function zonaEmpresaActiva(): Promise<string> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "Europe/Madrid";
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    return await getZonaHorariaEmpresa(supabase, empresaId);
  } catch {
    return "Europe/Madrid";
  }
}

// El rango del día/semana/mes se calcula SOBRE LA CLAVE "YYYY-MM-DD", nunca con
// `new Date(...)` + getDay()/setHours(): esos métodos usan la zona del PROCESO
// (UTC en Vercel), así que la ventana se desplazaba las horas de offset de la
// empresa y se colaban eventos de la madrugada del día siguiente mientras se
// perdían los de primera hora del propio día.

/** Suma días a una clave "YYYY-MM-DD" sin pasar por la zona local del proceso. */
function sumarDias(clave: string, dias: number): string {
  const [y, m, d] = clave.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Día de la semana de una clave "YYYY-MM-DD" con lunes = 0 … domingo = 6. */
function indiceDiaSemana(clave: string): number {
  const [y, m, d] = clave.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

export async function GET(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({
      connected: false,
      needsReauth: false,
      eventos: [],
    });
  }

  const url = new URL(request.url);

  // Si el caller pasa calendarIds explícitos los respetamos; si no, listamos
  // todos los calendarios del usuario (primary + secundarios + compartidos)
  // para no perder reuniones a las que ha sido invitado fuera de "primary".
  let calendarIds = url.searchParams
    .get("calendarIds")
    ?.split(",")
    .filter(Boolean);

  // Siempre listamos los calendarios del usuario para construir el mapa de
  // metadatos (nombre + color), de modo que cada evento sepa de qué calendario
  // procede y podamos pintar el recuadro de color como en Google Calendar.
  const calMeta: Record<string, { nombre: string; colorHex: string }> = {};
  const list = await googleFetchAuto<UserCalendarList>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
  );
  if (list.needsReauth) {
    return NextResponse.json({
      connected: true,
      needsReauth: true,
      eventos: [],
    });
  }
  const calItems = list.data?.items ?? [];
  for (const c of calItems) {
    calMeta[c.id] = {
      nombre: c.summaryOverride || c.summary || c.id,
      colorHex: c.backgroundColor || "#039be5",
    };
  }

  if (!calendarIds || calendarIds.length === 0) {
    calendarIds =
      calItems.length > 0
        ? calItems.filter((c) => c.selected !== false).map((c) => c.id)
        : ["primary"];
  }

  // Vista (day | week | month) y fecha de referencia (yyyy-mm-dd).
  // La ventana se ancla a la zona horaria de la EMPRESA ACTIVA (PRP-069): el
  // "día de hoy" es el de la empresa, no el del servidor.
  const vista = url.searchParams.get("view") ?? "week";
  const tz = await zonaEmpresaActiva();
  const fechaRef = url.searchParams.get("date") ?? hoyEnZona(tz);

  // Rango semiabierto [claveInicio, claveFin) en días locales de la empresa.
  let claveInicio: string;
  let claveFin: string;

  if (vista === "day") {
    claveInicio = fechaRef;
    claveFin = sumarDias(fechaRef, 1);
  } else if (vista === "month") {
    const [anio, mes] = fechaRef.split("-").map(Number);
    claveInicio = `${fechaRef.slice(0, 7)}-01`;
    // Primer día del mes siguiente (mes 12 → enero del año siguiente).
    claveFin =
      mes === 12
        ? `${anio + 1}-01-01`
        : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  } else {
    claveInicio = sumarDias(fechaRef, -indiceDiaSemana(fechaRef));
    claveFin = sumarDias(claveInicio, 7);
  }

  const params = new URLSearchParams({
    // Medianoche local de la empresa convertida al instante UTC real.
    timeMin: zonaLocalAUtcISO(claveInicio, "00:00", tz),
    timeMax: zonaLocalAUtcISO(claveFin, "00:00", tz),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
    // Google devuelve las horas de los eventos en esta zona, de modo que el
    // desglose por día/hora de abajo coincide con el calendario de la empresa.
    timeZone: tz,
  });

  // Pedimos los eventos de TODOS los calendarios seleccionados en paralelo
  const responses = await Promise.all(
    calendarIds.map(async (calId) => {
      const r = await googleFetchAuto<CalendarListResponse>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`,
      );
      return { calId, items: r.data?.items ?? [], needsReauth: r.needsReauth };
    }),
  );

  if (responses.some((r) => r.needsReauth)) {
    return NextResponse.json({
      connected: true,
      needsReauth: true,
      eventos: [],
    });
  }

  // Aplanamos manteniendo el calendarId de origen
  const data: CalendarListResponse = {
    items: responses.flatMap((r) =>
      r.items.map((ev) => ({ ...ev, _calId: r.calId })),
    ) as CalendarListResponse["items"],
  };

  if (!data || !data.items) {
    return NextResponse.json({
      connected: true,
      needsReauth: false,
      eventos: [],
    });
  }

  const eventos = data.items.map((ev) => {
    // Eventos all-day vienen con start.date (YYYY-MM-DD) en lugar de start.dateTime
    const allDay = !ev.start?.dateTime && !!ev.start?.date;

    const startStr = ev.start?.dateTime ?? `${ev.start?.date ?? ""}T00:00:00`;
    const endStr =
      ev.end?.dateTime ?? `${ev.end?.date ?? ev.start?.date ?? ""}T23:59:59`;
    const start = new Date(startStr);
    const end = new Date(endStr);

    // Día y minuto del evento EN LA ZONA DE LA EMPRESA. Con getDay()/getHours()
    // se usaba la zona del proceso (UTC en Vercel) y los eventos se pintaban
    // desplazados de columna y de hora respecto al calendario real.
    const claveDia = allDay
      ? (ev.start?.date ?? claveDiaEnZona(startStr, tz))
      : claveDiaEnZona(startStr, tz);
    const diaIndex = indiceDiaSemana(claveDia);
    const inicioMin = allDay ? 0 : minutosDiaEnZona(start, tz);
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

    const calId = ev._calId ?? "primary";
    const eventColorHex = ev.colorId
      ? GOOGLE_EVENT_COLORS[ev.colorId] ?? null
      : null;
    const meta = calMeta[calId];
    const calendarNombre = meta?.nombre ?? calId;
    const calendarColorHex = meta?.colorHex ?? "#039be5";

    return {
      id: ev.id,
      calendarId: calId,
      calendarNombre,
      // Color identificativo del calendario (recuadro tipo Google Calendar).
      // Si el evento tiene un color propio (colorId) lo respetamos como override.
      calendarColorHex: eventColorHex ?? calendarColorHex,
      titulo: ev.summary || "(Sin título)",
      descripcion: ev.description ?? "",
      hora: allDay ? "Todo el día" : formatHoraEnZona(startStr, tz),
      duracion,
      lugar: ev.location,
      participantes: ev.attendees?.map((a) => a.displayName || a.email),
      // Estado de respuesta del usuario a este evento ("accepted" | "declined" |
      // "tentative" | "needsAction"). Si no hay lista de asistentes es un evento
      // propio sin invitados → cuenta como aceptado.
      miRespuesta:
        ev.attendees?.find((a) => a.self)?.responseStatus ?? "accepted",
      color: colorFromId(ev.colorId),
      eventColorHex,
      diaIndex,
      inicioMin,
      duracionMin,
      allDay,
      // Fechas ISO completas para edición y para fecha exacta
      inicio: startStr,
      fin: endStr,
      // Fecha YYYY-MM-DD para agrupar en vistas mes/día (día de la EMPRESA:
      // con toISOString() el corte era a medianoche UTC y los eventos de última
      // hora saltaban al día siguiente).
      fechaDia: claveDia,
      // Link de Google Meet (si existe)
      meetLink:
        ev.hangoutLink ??
        ev.conferenceData?.entryPoints?.find(
          (ep) => ep.entryPointType === "video",
        )?.uri ??
        findMeetUrlIn(ev.location) ??
        findMeetUrlIn(ev.description) ??
        null,
    };
  });

  return NextResponse.json({
    connected: true,
    needsReauth: false,
    eventos,
  });
}
