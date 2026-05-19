"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  Loader2,
  Trash2,
  Pencil,
  X,
  Check,
  Menu as MenuIcon,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleReauthBanner } from "./GoogleReauthBanner";
import { GoogleAccountButton } from "./GoogleAccountButton";
import { useGoogleConnection } from "./useGoogleConnection";

type GoogleCalendar = {
  id: string;
  nombre: string;
  primary: boolean;
  color: string;
  rol: string;
  seleccionado: boolean;
};

type Evento = {
  id: string;
  calendarId: string;
  titulo: string;
  descripcion: string;
  hora: string;
  duracion: string;
  lugar?: string;
  participantes?: string[];
  color: "blue" | "emerald" | "orange" | "violet" | "red";
  eventColorHex?: string | null;
  diaIndex: number;
  inicioMin: number;
  duracionMin: number;
  allDay: boolean;
  inicio: string;
  fin: string;
  fechaDia: string; // YYYY-MM-DD
  meetLink?: string | null;
};

const FALLBACK_COLOR = "#039be5";

function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function textOnColor(hex: string): string {
  const c = (hex || FALLBACK_COLOR).replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 175 ? "#1a1a1a" : "#ffffff";
}

type Vista = "day" | "week" | "month";

const HORA_INICIO = 0;
const HORA_FIN = 23;
const HORAS = Array.from(
  { length: HORA_FIN - HORA_INICIO + 1 },
  (_, i) => i + HORA_INICIO,
);
const HORA_PX = 48;
const DIAS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MOCK_EVENTOS: Evento[] = [];

type SegmentoDia = {
  inicioMin: number;
  duracionMin: number;
  esInicio: boolean;
  esFin: boolean;
};

function segmentoEnDia(ev: Evento, dayIso: string): SegmentoDia | null {
  const dayStart = new Date(`${dayIso}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const evStart = new Date(ev.inicio);
  const evEnd = new Date(ev.fin);
  if (evEnd <= dayStart || evStart >= dayEnd) return null;
  const segStart = evStart > dayStart ? evStart : dayStart;
  const segEnd = evEnd < dayEnd ? evEnd : dayEnd;
  return {
    inicioMin: Math.max(0, (segStart.getTime() - dayStart.getTime()) / 60000),
    duracionMin: Math.max(15, (segEnd.getTime() - segStart.getTime()) / 60000),
    esInicio: evStart >= dayStart,
    esFin: evEnd <= dayEnd,
  };
}

function allDayCubreFecha(ev: Evento, dayIso: string): boolean {
  if (!ev.allDay) return false;
  const startDate = ev.inicio.slice(0, 10);
  const endDate = ev.fin.slice(0, 10);
  if (startDate === endDate) return dayIso === startDate;
  // Google all-day events: end.date es exclusivo → iterar [start, end)
  return dayIso >= startDate && dayIso < endDate;
}

interface CalendarDrawerProps {
  children: ReactNode;
}

function getInicioSemana(base: Date): Date {
  const hoy = new Date(base);
  const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - dia);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function fmtCorta(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function fmtMesAnio(d: Date): string {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function fmtFechaCompleta(d: Date): string {
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

type Form = {
  id?: string;
  calendarId: string;
  titulo: string;
  descripcion: string;
  lugar: string;
  fecha: string;
  inicio: string;
  fin: string;
  allDay: boolean;
  addMeet: boolean;
};

const FORM_VACIO: Form = {
  calendarId: "primary",
  titulo: "",
  descripcion: "",
  lugar: "",
  fecha: isoDate(new Date()),
  inicio: "09:00",
  fin: "10:00",
  allDay: false,
  addMeet: true,
};

export function CalendarDrawer({ children }: CalendarDrawerProps) {
  const { connected } = useGoogleConnection();
  const [vista, setVista] = useState<Vista>("week");
  const [fechaRef, setFechaRef] = useState(new Date());
  const [calendarios, setCalendarios] = useState<GoogleCalendar[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [eventos, setEventos] = useState<Evento[]>(MOCK_EVENTOS);
  const [cargando, setCargando] = useState(false);
  const [eventoSel, setEventoSel] = useState<Evento | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const nowTime = useNow();
  const nowIso = useMemo(() => isoDate(new Date(nowTime)), [nowTime]);
  const nowMinutes = useMemo(() => {
    const d = new Date(nowTime);
    return d.getHours() * 60 + d.getMinutes();
  }, [nowTime]);

  // 1) Lista de calendarios al conectar
  useEffect(() => {
    if (!connected) {
      setCalendarios([]);
      setEventos(MOCK_EVENTOS);
      setNeedsReauth(false);
      return;
    }
    fetch("/api/google/calendar/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsReauth || data.connected === false) {
          setNeedsReauth(true);
          setCalendarios([]);
          return;
        }
        if (data.connected && Array.isArray(data.calendarios)) {
          setNeedsReauth(false);
          setCalendarios(data.calendarios);
          const initial = new Set<string>(
            data.calendarios
              .filter((c: GoogleCalendar) => c.seleccionado || c.primary)
              .map((c: GoogleCalendar) => c.id),
          );
          if (initial.size === 0 && data.calendarios.length > 0) {
            initial.add(data.calendarios[0].id);
          }
          setSeleccionados(initial);
        }
      })
      .catch(() => setCalendarios([]));
  }, [connected]);

  // 2) Cargar eventos cuando cambian calendarios / vista / fecha
  useEffect(() => {
    if (!connected || seleccionados.size === 0) return;
    setCargando(true);
    const ids = Array.from(seleccionados).join(",");
    const params = new URLSearchParams({
      calendarIds: ids,
      view: vista,
      date: isoDate(fechaRef),
    });
    fetch(`/api/google/calendar/events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.needsReauth || data.connected === false) {
          setNeedsReauth(true);
          return;
        }
        if (data.connected && Array.isArray(data.eventos)) {
          setNeedsReauth(false);
          setEventos(data.eventos as Evento[]);
        }
      })
      .finally(() => setCargando(false));
  }, [connected, seleccionados, vista, fechaRef]);

  function recargarEventos() {
    if (!connected || seleccionados.size === 0) return;
    const ids = Array.from(seleccionados).join(",");
    const params = new URLSearchParams({
      calendarIds: ids,
      view: vista,
      date: isoDate(fechaRef),
    });
    fetch(`/api/google/calendar/events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && Array.isArray(data.eventos)) {
          setEventos(data.eventos as Evento[]);
        }
      });
  }

  // Navegación
  function navegar(delta: number) {
    const nueva = new Date(fechaRef);
    if (vista === "day") nueva.setDate(nueva.getDate() + delta);
    else if (vista === "week") nueva.setDate(nueva.getDate() + delta * 7);
    else nueva.setMonth(nueva.getMonth() + delta);
    setFechaRef(nueva);
  }

  function irAHoy() {
    setFechaRef(new Date());
  }

  // Texto del rango según vista
  const tituloRango = useMemo(() => {
    if (vista === "day") {
      return fmtFechaCompleta(fechaRef);
    } else if (vista === "month") {
      return fmtMesAnio(fechaRef).charAt(0).toUpperCase() + fmtMesAnio(fechaRef).slice(1);
    } else {
      const ini = getInicioSemana(fechaRef);
      const fin = new Date(ini);
      fin.setDate(ini.getDate() + 6);
      return `${fmtCorta(ini)} – ${fmtCorta(fin)}`;
    }
  }, [vista, fechaRef]);

  function toggleCalendario(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function abrirCrear(fechaBase?: Date, hora?: number) {
    if (!connected) {
      toast.error("Conecta Google para crear eventos");
      return;
    }
    const fecha = fechaBase ?? fechaRef;
    const hh = (hora ?? 9).toString().padStart(2, "0");
    const hh1 = ((hora ?? 9) + 1).toString().padStart(2, "0");
    setForm({
      ...FORM_VACIO,
      calendarId: Array.from(seleccionados)[0] || "primary",
      fecha: isoDate(fecha),
      inicio: `${hh}:00`,
      fin: `${hh1}:00`,
    });
  }

  function abrirEditar(ev: Evento) {
    const dt = new Date(ev.inicio);
    const fin = new Date(ev.fin);
    const fmt = (d: Date) =>
      `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    setForm({
      ...FORM_VACIO,
      id: ev.id,
      calendarId: ev.calendarId,
      titulo: ev.titulo,
      descripcion: ev.descripcion,
      lugar: ev.lugar ?? "",
      fecha: isoDate(dt),
      inicio: fmt(dt),
      fin: fmt(fin),
      allDay: ev.allDay,
    });
    setEventoSel(null);
  }

  async function guardar() {
    if (!form || !form.titulo) {
      toast.error("Falta el título");
      return;
    }
    setGuardando(true);
    let inicioISO: string;
    let finISO: string;
    if (form.allDay) {
      inicioISO = new Date(`${form.fecha}T00:00:00`).toISOString();
      const finFecha = new Date(`${form.fecha}T00:00:00`);
      finFecha.setDate(finFecha.getDate() + 1);
      finISO = finFecha.toISOString();
    } else {
      inicioISO = new Date(`${form.fecha}T${form.inicio}:00`).toISOString();
      finISO = new Date(`${form.fecha}T${form.fin}:00`).toISOString();
    }

    const payload = {
      id: form.id,
      calendarId: form.calendarId,
      titulo: form.titulo,
      descripcion: form.descripcion,
      lugar: form.lugar,
      inicio: inicioISO,
      fin: finISO,
      addMeet: form.addMeet && !form.id, // solo al crear, no al editar
    };

    const url = form.id
      ? "/api/google/calendar/update"
      : "/api/google/calendar/create";
    const method = form.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setGuardando(false);
    if (res.ok) {
      toast.success(form.id ? "Evento actualizado" : "Evento creado");
      setForm(null);
      recargarEventos();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message || "No se pudo guardar el evento");
    }
  }

  async function borrar() {
    if (!eventoSel) return;
    if (!confirm(`¿Borrar "${eventoSel.titulo}"?`)) return;
    const res = await fetch("/api/google/calendar/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventoSel.id, calendarId: eventoSel.calendarId }),
    });
    if (res.ok) {
      toast.success("Evento borrado");
      setEventoSel(null);
      recargarEventos();
    } else {
      toast.error("No se pudo borrar");
    }
  }

  // Helpers para vistas
  const semanaActual = useMemo(() => {
    const ini = getInicioSemana(fechaRef);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ini);
      d.setDate(ini.getDate() + i);
      return d;
    });
  }, [fechaRef]);

  const eventosTimed = eventos.filter((e) => !e.allDay);
  const eventosAllDay = eventos.filter((e) => e.allDay);

  const colorPorCalendario = useMemo(() => {
    const m = new Map<string, string>();
    calendarios.forEach((c) => m.set(c.id, c.color));
    return m;
  }, [calendarios]);

  function colorEvento(ev: Evento): string {
    return (
      ev.eventColorHex ||
      colorPorCalendario.get(ev.calendarId) ||
      FALLBACK_COLOR
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 bg-[#f6f8fc] [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Calendario · Google Calendar</SheetTitle>
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
            <div className="flex items-center gap-1 pl-1 pr-3">
              <CalendarLogo className="h-9 w-auto" />
            </div>
            {cargando && (
              <Loader2 className="h-4 w-4 animate-spin text-[#5f6368]" />
            )}
            <div className="ml-auto flex items-center gap-1">
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
          <GoogleReauthBanner servicio="el calendario" />
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={irAHoy}>
              Hoy
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navegar(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navegar(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-semibold capitalize text-foreground">
              {tituloRango}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs">Día</TabsTrigger>
                <TabsTrigger value="week" className="text-xs">Semana</TabsTrigger>
                <TabsTrigger value="month" className="text-xs">Mes</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => abrirCrear()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Crear
            </Button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar de calendarios */}
          {sidebarAbierto && (
          <aside className="w-56 shrink-0 overflow-y-auto border-r bg-muted/20 p-3">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mis calendarios
            </p>
            {calendarios.length === 0 && (
              connected ? (
                <div className="flex items-center justify-center px-2 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <p className="px-2 text-[11px] italic text-muted-foreground">
                  Conecta Google para ver tus calendarios
                </p>
              )
            )}
            <ul className="space-y-0.5">
              {calendarios.map((cal) => {
                const activo = seleccionados.has(cal.id);
                return (
                  <li key={cal.id}>
                    <button
                      type="button"
                      onClick={() => toggleCalendario(cal.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/70",
                        activo && "bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2",
                          activo ? "border-transparent" : "border-muted-foreground/40",
                        )}
                        style={activo ? { backgroundColor: cal.color } : undefined}
                      >
                        {activo && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className={cn("truncate", activo ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {cal.nombre}
                      </span>
                      {cal.primary && (
                        <Badge variant="outline" className="ml-auto h-4 px-1 text-[8px]">
                          Mío
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          )}

          {/* VISTA WEEK */}
          {vista === "week" && (
            <div className="flex flex-1 min-h-0 flex-col">
              {/* Cabecera de días */}
              <div className="flex shrink-0 border-b bg-card">
                <div className="w-[60px] shrink-0 border-r" />
                {semanaActual.map((d, i) => {
                  const esHoy = d.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 border-r px-2 py-2 text-center",
                        esHoy && "bg-blue-50 dark:bg-blue-950/30",
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {DIAS_CORTO[i]}
                      </p>
                      <p
                        className={cn(
                          "text-base font-bold",
                          esHoy ? "text-blue-600" : "text-foreground",
                        )}
                      >
                        {d.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Fila de all-day events */}
              {eventosAllDay.length > 0 && (
                <div className="flex shrink-0 border-b bg-muted/10">
                  <div className="w-[60px] shrink-0 border-r px-2 py-1 text-right text-[9px] uppercase text-muted-foreground">
                    Todo el día
                  </div>
                  {semanaActual.map((d, i) => {
                    const dayIso = isoDate(d);
                    const evs = eventosAllDay.filter((e) => allDayCubreFecha(e, dayIso));
                    const diaPasado = dayIso < nowIso;
                    return (
                      <div key={i} className={cn(
                        "flex-1 min-h-[28px] border-r p-1 space-y-0.5",
                        diaPasado && "bg-muted/30",
                      )}>
                        {evs.map((ev) => (
                          <button
                            key={`${ev.id}-${dayIso}`}
                            onClick={() => setEventoSel(ev)}
                            className={cn(
                              "block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium",
                              diaPasado && "opacity-70",
                            )}
                            style={{
                              backgroundColor: colorEvento(ev),
                              color: textOnColor(colorEvento(ev)),
                            }}
                          >
                            {ev.titulo}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Grid horario — 24 h con altura fija (HORA_PX) y scroll vertical */}
              <div className="flex flex-1 min-h-0 overflow-y-auto">
                <div className="flex w-[60px] shrink-0 flex-col border-r">
                  {HORAS.map((h) => (
                    <div
                      key={h}
                      style={{ height: HORA_PX }}
                      className="flex items-start justify-end border-b px-2 pt-0.5 text-[10px] text-muted-foreground"
                    >
                      {h.toString().padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {semanaActual.map((d, diaIdx) => {
                  const dayIso = isoDate(d);
                  const diaPasado = dayIso < nowIso;
                  const esHoy = dayIso === nowIso;
                  return (
                    <div
                      key={diaIdx}
                      className="relative flex flex-1 flex-col border-r"
                    >
                      {HORAS.map((h) => {
                        const slotPasado = diaPasado || (esHoy && (h + 1) * 60 <= nowMinutes);
                        return (
                          <div
                            key={h}
                            onClick={() => abrirCrear(d, h)}
                            style={{ height: HORA_PX }}
                            className={cn(
                              "cursor-pointer border-b transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20",
                              slotPasado && "bg-muted/40",
                            )}
                          />
                        );
                      })}

                      {esHoy && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                          style={{ top: (nowMinutes / 60) * HORA_PX }}
                        >
                          <span className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                          <span className="flex-1 h-px bg-red-500" />
                        </div>
                      )}

                      {eventosTimed.map((ev) => {
                        const seg = segmentoEnDia(ev, dayIso);
                        if (!seg) return null;
                        const top = (seg.inicioMin / 60) * HORA_PX;
                        const height = Math.max(18, (seg.duracionMin / 60) * HORA_PX - 2);
                        const bg = colorEvento(ev);
                        const txt = textOnColor(bg);
                        const finMs = new Date(ev.fin).getTime();
                        const inicioMs = new Date(ev.inicio).getTime();
                        const finalizado = finMs <= nowTime;
                        const enCurso = !finalizado && inicioMs <= nowTime;
                        return (
                          <button
                            key={`${ev.id}-${dayIso}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEventoSel(ev);
                            }}
                            className={cn(
                              "absolute left-0.5 right-0.5 z-10 overflow-hidden px-1.5 py-0.5 text-left text-[11px] leading-tight transition-shadow hover:z-20 hover:shadow-md",
                              seg.esInicio && "rounded-t-[4px]",
                              seg.esFin && "rounded-b-[4px]",
                              finalizado && "opacity-70",
                              enCurso && "ring-2 ring-red-400",
                            )}
                            style={{
                              top,
                              height,
                              backgroundColor: bg,
                              color: txt,
                            }}
                          >
                            <p className="truncate font-semibold">{ev.titulo}</p>
                            <p className="truncate text-[10px] opacity-90">
                              {seg.esInicio ? ev.hora : "continúa"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VISTA DAY */}
          {vista === "day" && (() => {
            const dayIso = isoDate(fechaRef);
            const allDayDelDia = eventosAllDay.filter((e) => allDayCubreFecha(e, dayIso));
            const diaPasado = dayIso < nowIso;
            const esHoy = dayIso === nowIso;
            return (
            <div className="flex flex-1 min-h-0 flex-col">
              {/* All-day del día */}
              {allDayDelDia.length > 0 && (
                <div className="shrink-0 border-b bg-muted/20 px-4 py-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Todo el día
                  </p>
                  <div className="space-y-1">
                    {allDayDelDia.map((ev) => (
                      <button
                        key={`${ev.id}-${dayIso}`}
                        onClick={() => setEventoSel(ev)}
                        className={cn(
                          "block w-full truncate rounded px-2 py-1 text-left text-xs font-medium",
                          diaPasado && "opacity-70",
                        )}
                        style={{
                          backgroundColor: colorEvento(ev),
                          color: textOnColor(colorEvento(ev)),
                        }}
                      >
                        {ev.titulo}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-1 min-h-0 overflow-y-auto">
                <div className="flex w-[60px] shrink-0 flex-col border-r">
                  {HORAS.map((h) => (
                    <div
                      key={h}
                      style={{ height: HORA_PX }}
                      className="flex items-start justify-end border-b px-2 pt-0.5 text-[10px] text-muted-foreground"
                    >
                      {h.toString().padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                <div className="relative flex flex-1 flex-col border-r">
                  {HORAS.map((h) => {
                    const slotPasado = diaPasado || (esHoy && (h + 1) * 60 <= nowMinutes);
                    return (
                      <div
                        key={h}
                        onClick={() => abrirCrear(fechaRef, h)}
                        style={{ height: HORA_PX }}
                        className={cn(
                          "cursor-pointer border-b transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20",
                          slotPasado && "bg-muted/40",
                        )}
                      />
                    );
                  })}

                  {esHoy && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: (nowMinutes / 60) * HORA_PX }}
                    >
                      <span className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                      <span className="flex-1 h-px bg-red-500" />
                    </div>
                  )}

                  {eventosTimed.map((ev) => {
                    const seg = segmentoEnDia(ev, dayIso);
                    if (!seg) return null;
                    const top = (seg.inicioMin / 60) * HORA_PX;
                    const height = Math.max(24, (seg.duracionMin / 60) * HORA_PX - 2);
                    const bg = colorEvento(ev);
                    const txt = textOnColor(bg);
                    const finMs = new Date(ev.fin).getTime();
                    const inicioMs = new Date(ev.inicio).getTime();
                    const finalizado = finMs <= nowTime;
                    const enCurso = !finalizado && inicioMs <= nowTime;
                    return (
                      <button
                        key={`${ev.id}-${dayIso}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEventoSel(ev);
                        }}
                        className={cn(
                          "absolute left-1 right-1 z-10 overflow-hidden px-2 py-1 text-left text-xs leading-tight transition-shadow hover:shadow-md",
                          seg.esInicio && "rounded-t-[4px]",
                          seg.esFin && "rounded-b-[4px]",
                          finalizado && "opacity-70",
                          enCurso && "ring-2 ring-red-400",
                        )}
                        style={{
                          top,
                          height,
                          backgroundColor: bg,
                          color: txt,
                        }}
                      >
                        <p className="truncate font-semibold">{ev.titulo}</p>
                        <p className="truncate text-[10px] opacity-90">
                          {seg.esInicio ? `${ev.hora} · ${ev.duracion}` : "continúa"}
                        </p>
                        {ev.lugar && <p className="truncate text-[10px] opacity-90">📍 {ev.lugar}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            );
          })()}

          {/* VISTA MONTH */}
          {vista === "month" && (
            <VistaMes
              fechaRef={fechaRef}
              eventos={eventos}
              onSelect={setEventoSel}
              onSlot={abrirCrear}
              colorPorCalendario={colorPorCalendario}
              nowIso={nowIso}
              nowTime={nowTime}
            />
          )}
        </div>

        {/* Detalles */}
        {eventoSel && (
          <div className="border-t bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colorEvento(eventoSel) }}
                  />
                  <h3 className="text-base font-bold text-foreground">{eventoSel.titulo}</h3>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> {eventoSel.hora}
                    {!eventoSel.allDay && ` · ${eventoSel.duracion}`}
                  </p>
                  {eventoSel.lugar && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> {eventoSel.lugar}
                    </p>
                  )}
                  {eventoSel.participantes && eventoSel.participantes.length > 0 && (
                    <p className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" /> {eventoSel.participantes.join(", ")}
                    </p>
                  )}
                  {eventoSel.descripcion && (
                    <p className="mt-2 whitespace-pre-wrap text-foreground">{eventoSel.descripcion}</p>
                  )}
                  {eventoSel.meetLink && (
                    <a
                      href={eventoSel.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" fill="currentColor" />
                        <rect x="3" y="6" width="12" height="12" rx="2" fill="currentColor" />
                      </svg>
                      Unirse a Google Meet
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" onClick={() => abrirEditar(eventoSel)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={borrar}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Borrar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEventoSel(null)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {form && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm font-bold">{form.id ? "Editar evento" : "Nuevo evento"}</p>
                <button type="button" onClick={() => setForm(null)} className="rounded p-1 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <Label className="text-[11px]">Título</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Reunión, cita, recordatorio…"
                    className="mt-1"
                    autoFocus
                  />
                </div>

                {calendarios.length > 0 && (
                  <div>
                    <Label className="text-[11px]">Calendario</Label>
                    <select
                      value={form.calendarId}
                      onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {calendarios
                        .filter((c) => c.rol === "owner" || c.rol === "writer")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="allday"
                      checked={form.allDay}
                      onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
                    />
                    <Label htmlFor="allday" className="text-xs cursor-pointer">
                      Todo el día
                    </Label>
                  </div>
                  {!form.id && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="addmeet"
                        checked={form.addMeet}
                        onChange={(e) => setForm({ ...form, addMeet: e.target.checked })}
                      />
                      <Label htmlFor="addmeet" className="flex items-center gap-1 text-xs cursor-pointer">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" fill="#00897B" />
                          <rect x="3" y="6" width="12" height="12" rx="2" fill="#00897B" />
                        </svg>
                        Google Meet
                      </Label>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-[11px]">Fecha</Label>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="mt-1"
                  />
                </div>
                {!form.allDay && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Inicio</Label>
                      <Input
                        type="time"
                        value={form.inicio}
                        onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Fin</Label>
                      <Input
                        type="time"
                        value={form.fin}
                        onChange={(e) => setForm({ ...form, fin: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-[11px]">Lugar</Label>
                  <Input
                    value={form.lugar}
                    onChange={(e) => setForm({ ...form, lugar: e.target.value })}
                    placeholder="Opcional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Descripción</Label>
                  <textarea
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Opcional"
                    className="mt-1 min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3">
                <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={guardar}
                  disabled={guardando}
                >
                  {guardando ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3.5 w-3.5" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CalendarLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 760 200" className={className} aria-hidden="true">
      <g transform="translate(3.75 3.75)">
        <path
          fill="#FFFFFF"
          d="M148.882,43.618l-47.368-5.263l-57.895,5.263L38.355,96.25l5.263,52.632l52.632,6.579l52.632-6.579l5.263-53.947L148.882,43.618z"
        />
        <path
          fill="#1A73E8"
          d="M65.211,125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c0.829,3.158,2.276,5.605,4.342,7.342c2.053,1.737,4.553,2.592,7.474,2.592c2.987,0,5.553-0.908,7.697-2.724s3.224-4.132,3.224-6.934c0-2.868-1.132-5.211-3.395-7.026s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921,0,5.382-0.789,7.382-2.368c2-1.579,3-3.737,3-6.487c0-2.447-0.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684,0-4.816,0.711-6.395,2.145s-2.724,3.197-3.447,5.276l-9.039-3.763c1.197-3.395,3.395-6.395,6.618-8.987c3.224-2.592,7.342-3.895,12.342-3.895c3.697,0,7.026,0.711,9.974,2.145c2.947,1.434,5.263,3.421,6.934,5.947c1.671,2.539,2.5,5.382,2.5,8.539c0,3.224-0.776,5.947-2.329,8.184c-1.553,2.237-3.461,3.947-5.724,5.145v0.539c2.987,1.25,5.421,3.158,7.342,5.724c1.908,2.566,2.868,5.632,2.868,9.211s-0.908,6.776-2.724,9.579c-1.816,2.803-4.329,5.013-7.513,6.618c-3.197,1.605-6.789,2.421-10.776,2.421C73.408,129.263,69.145,127.934,65.211,125.276z"
        />
        <path
          fill="#1A73E8"
          d="M121.25,79.961l-9.974,7.25l-5.013-7.605l17.987-12.974h6.895v61.197h-9.895L121.25,79.961z"
        />
        <path
          fill="#EA4335"
          d="M148.882,196.25l47.368-47.368l-23.684-10.526l-23.684,10.526l-10.526,23.684L148.882,196.25z"
        />
        <path
          fill="#34A853"
          d="M33.092,172.566l10.526,23.684h105.263v-47.368H43.618L33.092,172.566z"
        />
        <path
          fill="#4285F4"
          d="M12.039-3.75C3.316-3.75-3.75,3.316-3.75,12.039v136.842l23.684,10.526l23.684-10.526V43.618h105.263l10.526-23.684L148.882-3.75H12.039z"
        />
        <path
          fill="#188038"
          d="M-3.75,148.882v31.579c0,8.724,7.066,15.789,15.789,15.789h31.579v-47.368H-3.75z"
        />
        <path
          fill="#FBBC04"
          d="M148.882,43.618v105.263h47.368V43.618l-23.684-10.526L148.882,43.618z"
        />
        <path
          fill="#1967D2"
          d="M196.25,43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368H196.25z"
        />
      </g>
      <text
        x="225"
        y="142"
        fontFamily="'Product Sans', 'Google Sans', Arial, sans-serif"
        fontSize="110"
        fill="#5f6368"
      >
        Calendar
      </text>
    </svg>
  );
}

// ─── Vista Mes ───────────────────────────────────────────────
function VistaMes({
  fechaRef,
  eventos,
  onSelect,
  onSlot,
  colorPorCalendario,
  nowIso,
  nowTime,
}: {
  fechaRef: Date;
  eventos: Evento[];
  onSelect: (ev: Evento) => void;
  onSlot: (fecha: Date) => void;
  colorPorCalendario: Map<string, string>;
  nowIso: string;
  nowTime: number;
}) {
  const colorEv = (ev: Evento): string =>
    ev.eventColorHex ||
    colorPorCalendario.get(ev.calendarId) ||
    FALLBACK_COLOR;
  // Calculamos las celdas: empezamos en lunes de la semana del día 1, terminamos en domingo de la semana del último día
  const año = fechaRef.getFullYear();
  const mes = fechaRef.getMonth();
  const primero = new Date(año, mes, 1);
  const inicio = getInicioSemana(primero);
  const ultimo = new Date(año, mes + 1, 0);
  const fin = getInicioSemana(ultimo);
  fin.setDate(fin.getDate() + 7);

  const dias: Date[] = [];
  const cur = new Date(inicio);
  while (cur < fin) {
    dias.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {DIAS_LARGO.map((d) => (
          <div
            key={d}
            className="border-r px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const dayIso = isoDate(d);
          const esHoy = dayIso === nowIso;
          const esMesActual = d.getMonth() === fechaRef.getMonth();
          const diaPasado = esMesActual && dayIso < nowIso;
          const evs = eventos.filter((e) =>
            e.allDay ? allDayCubreFecha(e, dayIso) : segmentoEnDia(e, dayIso) !== null,
          );
          return (
            <div
              key={i}
              onClick={() => onSlot(d)}
              className={cn(
                "min-h-[100px] cursor-pointer border-b border-r p-1 transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-950/20",
                !esMesActual && "bg-muted/20 text-muted-foreground",
                diaPasado && "bg-muted/30",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    esHoy && "bg-blue-600 text-white",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {evs.slice(0, 3).map((ev) => {
                  const continua = !ev.allDay && ev.fechaDia !== dayIso;
                  const finalizado = new Date(ev.fin).getTime() <= nowTime;
                  return (
                    <button
                      key={`${ev.id}-${dayIso}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(ev);
                      }}
                      className={cn(
                        "block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
                        finalizado && "opacity-70",
                      )}
                      style={{
                        backgroundColor: colorEv(ev),
                        color: textOnColor(colorEv(ev)),
                      }}
                    >
                      {ev.allDay || continua ? "" : `${ev.hora} `}
                      {ev.titulo}
                    </button>
                  );
                })}
                {evs.length > 3 && (
                  <p className="px-1 text-[9px] text-muted-foreground">
                    + {evs.length - 3} más
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
