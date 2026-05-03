"use client";

import { ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import {
  Video, Clock, Users, RefreshCw, ExternalLink, Loader2, MapPin, X,
} from "lucide-react";
import {
  Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleAccountButton } from "./GoogleAccountButton";
import { useGoogleConnection } from "./useGoogleConnection";

interface EventoApi {
  id: string;
  calendarId: string;
  titulo: string;
  descripcion?: string;
  hora: string;
  duracion: string;
  lugar?: string;
  participantes?: string[];
  diaIndex: number;
  allDay: boolean;
  inicio: string;
  fin: string;
  fechaDia: string;
  meetLink: string | null;
}

interface ReunionesResponse {
  connected: boolean;
  needsReauth?: boolean;
  eventos: EventoApi[];
}

const DIAS_LARGOS = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];
const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function inicioSemanaLunes(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const diaSemana = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - diaSemana);
  return d;
}

function etiquetaFecha(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const hoyKey = ymd(hoy);
  const mananaDate = new Date(hoy);
  mananaDate.setDate(hoy.getDate() + 1);
  const mananaKey = ymd(mananaDate);
  const fechaKey = ymd(fecha);

  if (fechaKey === hoyKey) return "Hoy";
  if (fechaKey === mananaKey) return "Mañana";

  const dia = DIAS_LARGOS[fecha.getDay()];
  const mesCorto = MESES_CORTOS[fecha.getMonth()];
  return `${dia} ${fecha.getDate()} ${mesCorto}`;
}

export function MeetDrawer({ children }: { children: ReactNode }) {
  const { connected } = useGoogleConnection();
  const [eventos, setEventos] = useState<EventoApi[]>([]);
  const [eventosSinMeet, setEventosSinMeet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"hoy" | "semana">("hoy");
  const [needsReauth, setNeedsReauth] = useState(false);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setNeedsReauth(false);
    try {
      const ref = ymd(new Date());
      const r = await fetch(
        `/api/google/calendar/events?view=week&date=${ref}`,
        { cache: "no-store" },
      );
      if (!r.ok) {
        setEventos([]);
        setEventosSinMeet(0);
        return;
      }
      const data = (await r.json()) as ReunionesResponse;
      if (data.needsReauth) {
        setNeedsReauth(true);
        setEventos([]);
        setEventosSinMeet(0);
        return;
      }
      if (!data.connected) {
        setEventos([]);
        setEventosSinMeet(0);
        return;
      }
      const todos = data.eventos ?? [];
      const conMeet = todos.filter((e) => !!e.meetLink);
      const sinMeet = todos.length - conMeet.length;
      conMeet.sort(
        (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
      );
      setEventos(conMeet);
      setEventosSinMeet(sinMeet);
    } catch (err) {
      console.error("[meet-drawer] error cargando", err);
      setEventos([]);
      setEventosSinMeet(0);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    load();
  }, [load]);

  const grupos = useMemo(() => {
    const ahora = new Date();
    const hoyKey = ymd(ahora);
    const inicioSem = inicioSemanaLunes(ahora);
    const finSem = new Date(inicioSem);
    finSem.setDate(inicioSem.getDate() + 7);

    const hoy = eventos.filter((e) => ymd(new Date(e.inicio)) === hoyKey);
    const semana = eventos.filter((e) => {
      const t = new Date(e.inicio).getTime();
      return (
        t >= inicioSem.getTime() &&
        t < finSem.getTime() &&
        ymd(new Date(e.inicio)) !== hoyKey
      );
    });
    return { hoy, semana };
  }, [eventos]);

  const lista = tab === "hoy" ? grupos.hoy : grupos.semana;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">Google Meet — Reuniones</SheetTitle>
        <SheetHeader className="border-b px-3 py-2">
          <div className="flex items-center gap-1">
            <Video className="h-5 w-5 text-emerald-600" />
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-8 w-8"
                onClick={load} disabled={loading}
                title="Actualizar"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <GoogleAccountButton />
              <SheetClose asChild>
                <button
                  type="button"
                  className="ml-1 rounded-full p-2 hover:bg-black/5 transition-colors"
                  title="Cerrar"
                >
                  <X className="h-5 w-5 text-[#5f6368]" />
                </button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        {!connected && (
          <div className="border-b bg-muted/30 px-5 py-3">
            <GoogleConnectBanner servicio="Google Calendar" />
          </div>
        )}

        {connected && needsReauth && (
          <div className="border-b bg-amber-50/60 px-5 py-3">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  La sesión con Google ha caducado
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Reconecta tu cuenta para volver a cargar las reuniones.
                </p>
              </div>
              <a
                href={`/api/google/connect?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-amber-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
              >
                Reconectar
              </a>
            </div>
          </div>
        )}

        <div className="flex border-b bg-muted/20 shrink-0">
          {(["hoy", "semana"] as const).map((t) => {
            const count = t === "hoy" ? grupos.hoy.length : grupos.semana.length;
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

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando reuniones…
            </div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 px-6 text-center text-muted-foreground">
              <Video className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">
                {tab === "hoy" ? "No hay reuniones hoy" : "No hay reuniones esta semana"}
              </p>
              <p className="text-xs mt-1 opacity-70">Los eventos con Google Meet aparecerán aquí</p>
              {eventosSinMeet > 0 && (
                <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
                  Tienes {eventosSinMeet}{" "}
                  {eventosSinMeet === 1 ? "evento este mes" : "eventos este mes"}{" "}
                  sin videollamada de Meet. Edítalos en Google Calendar y añade
                  Meet, o créalos desde aquí marcando «Google Meet».
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {lista.map((ev) => {
                const fecha = etiquetaFecha(ev.inicio);
                const asistentes = ev.participantes?.length ?? 0;
                return (
                  <li
                    key={`${ev.calendarId}-${ev.id}`}
                    className="px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1 block">
                          {fecha}
                        </span>
                        <p className="font-semibold text-sm leading-tight">
                          {ev.titulo}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {ev.allDay ? "Todo el día" : `${ev.hora} · ${ev.duracion}`}
                          </span>
                          {asistentes > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {asistentes} {asistentes === 1 ? "asistente" : "asistentes"}
                            </span>
                          )}
                          {ev.lugar && (
                            <span className="flex max-w-[160px] items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{ev.lugar}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {ev.meetLink && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0 h-9 px-4 shadow-sm shadow-emerald-600/20"
                          onClick={() => window.open(ev.meetLink!, "_blank")}
                        >
                          <Video className="h-3.5 w-3.5" />
                          Entrar
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
