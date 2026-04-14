"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import {
  Video, Clock, Users, RefreshCw, ExternalLink,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleAccountButton } from "./GoogleAccountButton";
import { useGoogleConnection } from "./useGoogleConnection";
import {
  format, isToday, isTomorrow, parseISO, addDays,
  startOfDay, endOfDay, startOfWeek, endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

interface CalEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
  organizer?: { email: string; displayName?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
}

function getMeetLink(event: CalEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video"
  );
  return entry?.uri ?? null;
}

function formatEventTime(event: CalEvent): string {
  const startStr = event.start.dateTime;
  const endStr = event.end.dateTime;
  if (!startStr) return "Todo el día";
  const s = format(parseISO(startStr), "HH:mm");
  const e = endStr ? format(parseISO(endStr), "HH:mm") : "";
  return `${s}${e ? ` – ${e}` : ""}`;
}

function getDayLabel(event: CalEvent): string {
  const d = event.start.dateTime ?? event.start.date ?? "";
  if (!d) return "";
  try {
    const date = parseISO(d);
    if (isToday(date)) return "Hoy";
    if (isTomorrow(date)) return "Mañana";
    return format(date, "EEEE d MMM", { locale: es });
  } catch {
    return "";
  }
}

const MOCK_MEETINGS: CalEvent[] = [
  {
    id: "m1",
    summary: "Reunión semanal de equipo",
    start: { dateTime: new Date(Date.now() + 3_600_000).toISOString() },
    end: { dateTime: new Date(Date.now() + 5_400_000).toISOString() },
    hangoutLink: "https://meet.google.com/demo-link",
    organizer: { email: "direccion@balles.com", displayName: "Dirección" },
    attendees: [{ email: "a@b.com" }, { email: "c@d.com" }, { email: "e@f.com" }],
  },
  {
    id: "m2",
    summary: "Revisión de inventario con logística",
    start: { dateTime: new Date(Date.now() + 86_400_000 + 3_600_000).toISOString() },
    end: { dateTime: new Date(Date.now() + 86_400_000 + 5_400_000).toISOString() },
    hangoutLink: "https://meet.google.com/demo-link-2",
    organizer: { email: "logistica@balles.com" },
    attendees: [{ email: "a@b.com" }, { email: "b@c.com" }],
  },
];

export function MeetDrawer({ children }: { children: ReactNode }) {
  const { connected } = useGoogleConnection();
  const [events, setEvents] = useState<CalEvent[]>(MOCK_MEETINGS);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"hoy" | "semana">("hoy");

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const now = new Date();
      const end = addDays(now, 7);
      const r = await fetch(
        `/api/google/calendar/events?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}`
      );
      if (!r.ok) return;
      const data = await r.json();
      const items: CalEvent[] = (data.items ?? []).filter(
        (e: CalEvent) => getMeetLink(e)
      );
      setEvents(items.length > 0 ? items : MOCK_MEETINGS);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    load();
  }, [load]);

  const todayMeetings = events.filter((e) => {
    const d = e.start.dateTime ?? e.start.date ?? "";
    try {
      return isToday(parseISO(d));
    } catch {
      return false;
    }
  });

  const weekMeetings = events.filter((e) => {
    const d = e.start.dateTime ?? e.start.date ?? "";
    try {
      return !isToday(parseISO(d));
    } catch {
      return false;
    }
  });

  const displayed = tab === "hoy" ? todayMeetings : weekMeetings;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-emerald-600" />
              Google Meet — Reuniones
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={load} disabled={loading}
                title="Actualizar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <GoogleAccountButton />
            </div>
          </div>
        </SheetHeader>

        {!connected && (
          <div className="border-b bg-muted/30 px-5 py-3">
            <GoogleConnectBanner servicio="Google Calendar" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b bg-muted/20 shrink-0">
          {(["hoy", "semana"] as const).map((t) => {
            const count = t === "hoy" ? todayMeetings.length : weekMeetings.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "hoy" ? "Hoy" : "Esta semana"}
                {count > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Meeting list */}
        <div className="flex-1 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
              <Video className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">
                {tab === "hoy" ? "No hay reuniones hoy" : "No hay reuniones esta semana"}
              </p>
              <p className="text-xs mt-1 opacity-70">Los eventos con Google Meet aparecerán aquí</p>
            </div>
          ) : (
            <div className="divide-y">
              {displayed.map((event) => {
                const link = getMeetLink(event);
                const time = formatEventTime(event);
                const dayLabel = tab === "semana" ? getDayLabel(event) : null;
                const attendeeCount = event.attendees?.length ?? 0;

                return (
                  <div
                    key={event.id}
                    className="px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {dayLabel && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1 block">
                            {dayLabel}
                          </span>
                        )}
                        <p className="font-semibold text-sm leading-tight">
                          {event.summary}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {time}
                          </span>
                          {attendeeCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {attendeeCount} asistentes
                            </span>
                          )}
                          {event.organizer?.displayName && (
                            <span className="truncate max-w-[120px]">
                              {event.organizer.displayName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botón directo de entrar */}
                      {link && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0 h-9 px-4 shadow-sm shadow-emerald-600/20"
                          onClick={() => window.open(link, "_blank")}
                        >
                          <Video className="h-3.5 w-3.5" />
                          Entrar
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
