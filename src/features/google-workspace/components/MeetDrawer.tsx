"use client";

import { ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import {
  Video, Clock, Users, RefreshCw, ExternalLink, Loader2, MapPin, X,
  ChevronLeft, ChevronRight, List, CalendarRange, Menu as MenuIcon,
} from "lucide-react";
import {
  Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleReauthBanner } from "./GoogleReauthBanner";
import { GoogleAccountButton } from "./GoogleAccountButton";
import { useGoogleConnection } from "./useGoogleConnection";
import { MeetCalendarGrid } from "./MeetCalendarGrid";
import { CalendarSidebar, type SidebarCalendar } from "./CalendarSidebar";

interface EventoApi {
  id: string;
  calendarId: string;
  calendarNombre?: string;
  calendarColorHex?: string;
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

type Vista = "dia" | "semana" | "mes";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

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

function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
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

function parseYmd(s: string): Date {
  const d = new Date(`${s}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Desplaza la fecha de referencia hacia delante/atrás según la vista activa.
function desplazar(refYmd: string, vista: Vista, dir: 1 | -1): string {
  const d = parseYmd(refYmd);
  if (vista === "dia") d.setDate(d.getDate() + dir);
  else if (vista === "semana") d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return ymd(d);
}

// Texto del rango visible (lo que se ve en Calendar como cabecera).
function etiquetaRango(refYmd: string, vista: Vista): string {
  const d = parseYmd(refYmd);
  if (vista === "dia") {
    const hoyKey = ymd(new Date());
    if (refYmd === hoyKey) return "Hoy";
    const dia = DIAS_LARGOS[d.getDay()];
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
  }
  if (vista === "mes") {
    const mes = MESES_LARGOS[d.getMonth()];
    return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`;
  }
  // semana: lunes → domingo
  const ini = inicioSemanaLunes(d);
  const fin = new Date(ini);
  fin.setDate(ini.getDate() + 6);
  const mismoMes = ini.getMonth() === fin.getMonth();
  if (mismoMes) {
    return `${ini.getDate()} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`;
  }
  return `${ini.getDate()} ${MESES_CORTOS[ini.getMonth()]} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`;
}

export function MeetDrawer({ children }: { children: ReactNode }) {
  const { connected } = useGoogleConnection();
  const [eventosAll, setEventosAll] = useState<EventoApi[]>([]);
  const [eventosSinMeet, setEventosSinMeet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState<Vista>("dia");
  const [refDate, setRefDate] = useState<string>(() => ymd(new Date()));
  const [modo, setModo] = useState<"agenda" | "calendario">("agenda");
  const [soloMeet, setSoloMeet] = useState(false);
  const [calendarios, setCalendarios] = useState<SidebarCalendar[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const nowTime = useNow();

  // Lista de calendarios (para el filtro) al conectar
  useEffect(() => {
    if (!connected) {
      setCalendarios([]);
      setSeleccionados(new Set());
      return;
    }
    fetch("/api/google/calendar/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && Array.isArray(data.calendarios)) {
          const cals: SidebarCalendar[] = data.calendarios.map(
            (c: {
              id: string;
              nombre: string;
              color: string;
              primary?: boolean;
            }) => ({
              id: c.id,
              nombre: c.nombre,
              color: c.color,
              primary: c.primary,
            }),
          );
          setCalendarios(cals);
          const init = new Set<string>(
            data.calendarios
              .filter((c: { seleccionado?: boolean }) => c.seleccionado)
              .map((c: { id: string }) => c.id),
          );
          if (init.size === 0) cals.forEach((c) => init.add(c.id));
          setSeleccionados(init);
        }
      })
      .catch(() => {});
  }, [connected]);

  const toggleCal = useCallback((id: string) => {
    setSeleccionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const rangoIncluyeHoy = useMemo(() => {
    const hoy = new Date();
    const hoyKey = ymd(hoy);
    const ref = parseYmd(refDate);
    if (vista === "dia") return refDate === hoyKey;
    if (vista === "mes") {
      return (
        ref.getMonth() === hoy.getMonth() &&
        ref.getFullYear() === hoy.getFullYear()
      );
    }
    const ini = inicioSemanaLunes(ref);
    const fin = new Date(ini);
    fin.setDate(ini.getDate() + 7);
    return hoy.getTime() >= ini.getTime() && hoy.getTime() < fin.getTime();
  }, [vista, refDate]);

  const load = useCallback(async () => {
    if (!connected) return;
    // Si ya cargó la lista y el usuario no dejó ningún calendario, no hay nada.
    if (calendarios.length > 0 && seleccionados.size === 0) {
      setEventosAll([]);
      setEventosSinMeet(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNeedsReauth(false);
    try {
      const apiView =
        vista === "dia" ? "day" : vista === "mes" ? "month" : "week";
      const params = new URLSearchParams({ view: apiView, date: refDate });
      if (calendarios.length > 0) {
        params.set("calendarIds", Array.from(seleccionados).join(","));
      }
      const r = await fetch(`/api/google/calendar/events?${params}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        setEventosAll([]);
        setEventosSinMeet(0);
        return;
      }
      const data = (await r.json()) as ReunionesResponse;
      if (data.needsReauth) {
        setNeedsReauth(true);
        setEventosAll([]);
        setEventosSinMeet(0);
        return;
      }
      if (!data.connected) {
        setEventosAll([]);
        setEventosSinMeet(0);
        return;
      }
      const todos = (data.eventos ?? []).slice();
      const sinMeet = todos.filter((e) => !e.meetLink).length;
      todos.sort(
        (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
      );
      setEventosAll(todos);
      setEventosSinMeet(sinMeet);
    } catch (err) {
      console.error("[meet-drawer] error cargando", err);
      setEventosAll([]);
      setEventosSinMeet(0);
    } finally {
      setLoading(false);
    }
  }, [connected, vista, refDate, calendarios, seleccionados]);

  useEffect(() => {
    load();
  }, [load]);

  // Agenda: solo reuniones con Meet (ya vienen ordenadas por hora).
  const lista = useMemo(
    () => eventosAll.filter((e) => !!e.meetLink),
    [eventosAll],
  );
  const pendientes = useMemo(
    () => lista.filter((e) => new Date(e.fin).getTime() > nowTime).length,
    [lista, nowTime],
  );

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 bg-[#f6f8fc] [&>button]:hidden">
        <SheetTitle className="sr-only">Google Meet — Reuniones</SheetTitle>
        <SheetHeader className="bg-[#f6f8fc] px-2 py-2 border-b border-transparent">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarAbierto((v) => !v)}
              className="rounded-full p-3 hover:bg-black/5 transition-colors"
              title="Menú principal"
            >
              <MenuIcon className="h-5 w-5 text-[#5f6368]" />
            </button>
            <div className="flex items-center gap-1 pr-3">
              <MeetLogo className="h-9 w-auto" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="rounded-full p-3 hover:bg-black/5 transition-colors disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCw className={`h-5 w-5 text-[#5f6368] ${loading ? "animate-spin" : ""}`} />
              </button>
              <GoogleAccountButton />
              <SheetClose asChild>
                <button
                  type="button"
                  className="ml-1 rounded-full p-3 hover:bg-black/5 transition-colors"
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
          <GoogleReauthBanner servicio="las reuniones" />
        )}

        {/* Toolbar estilo Calendar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2 shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDate(ymd(new Date()))}
              disabled={rangoIncluyeHoy}
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRefDate((r) => desplazar(r, vista, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRefDate((r) => desplazar(r, vista, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-1 truncate text-sm font-semibold capitalize text-foreground">
              {etiquetaRango(refDate, vista)}
            </span>
            {pendientes > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
                {pendientes}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
              <TabsList className="h-8">
                <TabsTrigger value="dia" className="text-xs">Día</TabsTrigger>
                <TabsTrigger value="semana" className="text-xs">Semana</TabsTrigger>
                <TabsTrigger value="mes" className="text-xs">Mes</TabsTrigger>
              </TabsList>
            </Tabs>
            {/* Conmutador agenda ↔ calendario */}
            <div className="flex items-center rounded-full border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setModo("agenda")}
                className={`rounded-full p-1.5 transition-colors ${
                  modo === "agenda"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-[#5f6368] hover:text-foreground"
                }`}
                title="Vista agenda"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setModo("calendario")}
                className={`rounded-full p-1.5 transition-colors ${
                  modo === "calendario"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-[#5f6368] hover:text-foreground"
                }`}
                title="Vista calendario"
              >
                <CalendarRange className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {modo === "calendario" && (
          <div className="flex items-center justify-between gap-2 border-b bg-emerald-50/40 px-3 py-1.5 shrink-0">
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-800">
              <Video className="h-3.5 w-3.5" />
              Resaltando reuniones con Meet
            </span>
            <button
              type="button"
              onClick={() => setSoloMeet((v) => !v)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                soloMeet
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              }`}
              title={
                soloMeet
                  ? "Mostrando solo reuniones con Meet"
                  : "Mostrando el resto de eventos en gris"
              }
            >
              {soloMeet ? "Solo Meet" : "Atenuar resto"}
            </button>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {sidebarAbierto && connected && (
            <CalendarSidebar
              calendarios={calendarios}
              seleccionados={seleccionados}
              onToggle={toggleCal}
              fechaRef={parseYmd(refDate)}
              onSelectDate={(d) => setRefDate(ymd(d))}
              nowIso={ymd(new Date())}
              connected={connected}
            />
          )}
          <div className="flex flex-1 min-w-0 flex-col">
        {modo === "calendario" ? (
          loading ? (
            <div className="flex flex-1 min-h-0 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <MeetCalendarGrid
              eventos={eventosAll}
              vista={vista}
              refDate={refDate}
              nowTime={nowTime}
              soloMeet={soloMeet}
              onAbrir={(ev) =>
                ev.meetLink && window.open(ev.meetLink, "_blank")
              }
            />
          )
        ) : (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 px-6 text-center text-muted-foreground">
              <Video className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">
                {vista === "dia"
                  ? "No hay reuniones este día"
                  : vista === "semana"
                    ? "No hay reuniones esta semana"
                    : "No hay reuniones este mes"}
              </p>
              <p className="text-xs mt-1 opacity-70">Los eventos con Google Meet aparecerán aquí</p>
              {eventosSinMeet > 0 && (
                <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
                  Tienes {eventosSinMeet}{" "}
                  {eventosSinMeet === 1 ? "evento en este periodo" : "eventos en este periodo"}{" "}
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
                const inicioMs = new Date(ev.inicio).getTime();
                const finMs = new Date(ev.fin).getTime();
                const finalizada = finMs <= nowTime;
                const enCurso = !finalizada && inicioMs <= nowTime;
                const color = ev.calendarColorHex || "#039be5";
                return (
                  <li
                    key={`${ev.calendarId}-${ev.id}`}
                    style={{ borderLeft: `4px solid ${color}` }}
                    className={cn(
                      "px-5 py-4 hover:bg-muted/30 transition-colors",
                      finalizada && "opacity-75",
                      enCurso && "bg-emerald-50/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {(vista !== "dia" || enCurso || finalizada) && (
                          <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                            {vista !== "dia" && fecha}
                            {enCurso && (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                En curso
                              </span>
                            )}
                            {finalizada && (
                              <span className="font-medium normal-case tracking-normal text-muted-foreground">
                                {vista !== "dia" ? "· " : ""}Finalizada
                              </span>
                            )}
                          </span>
                        )}
                        <p className="font-semibold text-sm leading-tight">
                          {ev.titulo}
                        </p>
                        {/* Calendario de origen — recuadro de color tipo Google Calendar */}
                        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate">
                            {ev.calendarNombre || "Calendario"}
                          </span>
                        </span>
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
                          className={cn(
                            "gap-1.5 shrink-0 h-9 px-4 text-white shadow-sm",
                            finalizada
                              ? "bg-gray-400 hover:bg-gray-500 shadow-gray-400/20"
                              : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20",
                          )}
                          onClick={() => window.open(ev.meetLink!, "_blank")}
                          title={
                            finalizada
                              ? "Reunión finalizada — abrir en Meet"
                              : undefined
                          }
                        >
                          <Video className="h-3.5 w-3.5" />
                          {finalizada ? "Acceder" : "Entrar"}
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
        )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MeetLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 72" className={className} aria-hidden="true">
      <path
        fill="#00832d"
        d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"
      />
      <path
        fill="#0066da"
        d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z"
      />
      <path
        fill="#e94235"
        d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z"
      />
      <path fill="#2684fc" d="M20.5 20.5H0v31h20.5z" />
      <path
        fill="#00ac47"
        d="M82.6 8.68L69.5 19.42v33.66l13.16 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"
      />
      <path
        fill="#ffba00"
        d="M63.5 0h-43v20.5h29V36l20-16.57V6c0-3.315-2.685-6-6-6z"
      />
      <text
        x="100"
        y="50"
        fontFamily="'Product Sans', 'Google Sans', Arial, sans-serif"
        fontSize="40"
        fill="#5f6368"
      >
        Meet
      </text>
    </svg>
  );
}
