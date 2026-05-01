"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
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
  colorHex: string;
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
const MINUTOS_DIA = 24 * 60;
const DIAS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MOCK_EVENTOS: Evento[] = [];

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

  // 1) Lista de calendarios al conectar
  useEffect(() => {
    if (!connected) {
      setCalendarios([]);
      setEventos(MOCK_EVENTOS);
      return;
    }
    fetch("/api/google/calendar/list")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && Array.isArray(data.calendarios)) {
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
        if (data.connected && Array.isArray(data.eventos)) {
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

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-screen max-w-none flex flex-col gap-0 p-0 sm:max-w-none [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Calendario · Google Calendar</SheetTitle>
        <SheetHeader className="border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            {cargando && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <div className="ml-auto flex items-center gap-1">
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
          <aside className="w-56 shrink-0 overflow-y-auto border-r bg-muted/20 p-3">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mis calendarios
            </p>
            {calendarios.length === 0 && (
              <p className="px-2 text-[11px] italic text-muted-foreground">
                {connected ? "Cargando…" : "Conecta Google para ver tus calendarios"}
              </p>
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
                    const evs = eventosAllDay.filter((e) => e.fechaDia === dayIso);
                    return (
                      <div key={i} className="flex-1 min-h-[28px] border-r p-1 space-y-0.5">
                        {evs.map((ev) => (
                          <button
                            key={ev.id}
                            onClick={() => setEventoSel(ev)}
                            className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium"
                            style={{
                              backgroundColor: ev.colorHex,
                              color: textOnColor(ev.colorHex),
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

              {/* Grid horario — 24 h repartidas por flex */}
              <div className="flex flex-1 min-h-0">
                <div className="flex w-[60px] shrink-0 flex-col border-r">
                  {HORAS.map((h) => (
                    <div
                      key={h}
                      className="flex flex-1 items-start justify-end border-b px-2 pt-0.5 text-[10px] text-muted-foreground"
                    >
                      {h.toString().padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {semanaActual.map((d, diaIdx) => {
                  const dayIso = isoDate(d);
                  const evsDelDia = eventosTimed.filter((e) => e.fechaDia === dayIso);
                  return (
                    <div
                      key={diaIdx}
                      className="relative flex flex-1 flex-col border-r"
                    >
                      {HORAS.map((h) => (
                        <div
                          key={h}
                          onClick={() => abrirCrear(d, h)}
                          className="flex-1 cursor-pointer border-b transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                        />
                      ))}

                      {evsDelDia.map((ev) => {
                        const topPct = (ev.inicioMin / MINUTOS_DIA) * 100;
                        const heightPct = (ev.duracionMin / MINUTOS_DIA) * 100;
                        if (topPct < 0 || topPct >= 100) return null;
                        const txt = textOnColor(ev.colorHex);
                        return (
                          <button
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEventoSel(ev);
                            }}
                            className="absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-[4px] px-1.5 py-0.5 text-left text-[11px] leading-tight transition-shadow hover:z-20 hover:shadow-md"
                            style={{
                              top: `${topPct}%`,
                              height: `calc(${heightPct}% - 2px)`,
                              minHeight: 18,
                              backgroundColor: ev.colorHex,
                              color: txt,
                            }}
                          >
                            <p className="truncate font-semibold">{ev.titulo}</p>
                            <p className="truncate text-[10px] opacity-90">{ev.hora}</p>
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
          {vista === "day" && (
            <div className="flex flex-1 min-h-0 flex-col">
              {/* All-day del día */}
              {eventosAllDay.filter((e) => e.fechaDia === isoDate(fechaRef)).length > 0 && (
                <div className="shrink-0 border-b bg-muted/20 px-4 py-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Todo el día
                  </p>
                  <div className="space-y-1">
                    {eventosAllDay
                      .filter((e) => e.fechaDia === isoDate(fechaRef))
                      .map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setEventoSel(ev)}
                          className="block w-full truncate rounded px-2 py-1 text-left text-xs font-medium"
                          style={{
                            backgroundColor: ev.colorHex,
                            color: textOnColor(ev.colorHex),
                          }}
                        >
                          {ev.titulo}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex flex-1 min-h-0">
                <div className="flex w-[60px] shrink-0 flex-col border-r">
                  {HORAS.map((h) => (
                    <div
                      key={h}
                      className="flex flex-1 items-start justify-end border-b px-2 pt-0.5 text-[10px] text-muted-foreground"
                    >
                      {h.toString().padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                <div className="relative flex flex-1 flex-col border-r">
                  {HORAS.map((h) => (
                    <div
                      key={h}
                      onClick={() => abrirCrear(fechaRef, h)}
                      className="flex-1 cursor-pointer border-b transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                    />
                  ))}
                  {eventosTimed
                    .filter((e) => e.fechaDia === isoDate(fechaRef))
                    .map((ev) => {
                      const topPct = (ev.inicioMin / MINUTOS_DIA) * 100;
                      const heightPct = (ev.duracionMin / MINUTOS_DIA) * 100;
                      if (topPct < 0 || topPct >= 100) return null;
                      const txt = textOnColor(ev.colorHex);
                      return (
                        <button
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventoSel(ev);
                          }}
                          className="absolute left-1 right-1 z-10 overflow-hidden rounded-[4px] px-2 py-1 text-left text-xs leading-tight transition-shadow hover:shadow-md"
                          style={{
                            top: `${topPct}%`,
                            height: `calc(${heightPct}% - 2px)`,
                            minHeight: 24,
                            backgroundColor: ev.colorHex,
                            color: txt,
                          }}
                        >
                          <p className="truncate font-semibold">{ev.titulo}</p>
                          <p className="truncate text-[10px] opacity-90">
                            {ev.hora} · {ev.duracion}
                          </p>
                          {ev.lugar && <p className="truncate text-[10px] opacity-90">📍 {ev.lugar}</p>}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* VISTA MONTH */}
          {vista === "month" && <VistaMes fechaRef={fechaRef} eventos={eventos} onSelect={setEventoSel} onSlot={abrirCrear} />}
        </div>

        {/* Detalles */}
        {eventoSel && (
          <div className="border-t bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: eventoSel.colorHex }}
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

// ─── Vista Mes ───────────────────────────────────────────────
function VistaMes({
  fechaRef,
  eventos,
  onSelect,
  onSlot,
}: {
  fechaRef: Date;
  eventos: Evento[];
  onSelect: (ev: Evento) => void;
  onSlot: (fecha: Date) => void;
}) {
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
          const esHoy = d.toDateString() === new Date().toDateString();
          const esMesActual = d.getMonth() === fechaRef.getMonth();
          const evs = eventos.filter((e) => e.fechaDia === dayIso);
          return (
            <div
              key={i}
              onClick={() => onSlot(d)}
              className={cn(
                "min-h-[100px] cursor-pointer border-b border-r p-1 transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-950/20",
                !esMesActual && "bg-muted/20 text-muted-foreground",
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
                {evs.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(ev);
                    }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium"
                    style={{
                      backgroundColor: ev.colorHex,
                      color: textOnColor(ev.colorHex),
                    }}
                  >
                    {ev.allDay ? "" : `${ev.hora} `}
                    {ev.titulo}
                  </button>
                ))}
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
