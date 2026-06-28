"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Search,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { GoogleReauthBanner } from "./GoogleReauthBanner";
import { GoogleAccountButton } from "./GoogleAccountButton";
import { useGoogleConnection } from "./useGoogleConnection";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { CalendarSidebar } from "./CalendarSidebar";
import { loadUserPref, saveUserPref } from "@/shared/io/user-preferences";
import {
  loadCalendariosSeleccionados,
  saveCalendariosSeleccionados,
} from "../lib/calendar-prefs";
import {
  TZ_HORA_SECUNDARIA_KEY,
  horaEnTZ,
  labelTZLocal,
  shortTZLabel,
} from "../lib/timezones";
import { SelectorTZ } from "./SelectorTZ";

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
const GRID_PX = HORAS.length * HORA_PX; // 1152
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

// Layout estilo Google Calendar: cuando varios eventos se solapan en el tiempo,
// el recuadro se divide en columnas lado a lado (col = índice, cols = total).
type LayoutEvento = { col: number; cols: number };

function calcularLayoutDia(eventos: Evento[], dayIso: string): Map<string, LayoutEvento> {
  const segs = eventos
    .map((ev) => {
      const seg = segmentoEnDia(ev, dayIso);
      if (!seg) return null;
      return { id: ev.id, inicio: seg.inicioMin, fin: seg.inicioMin + seg.duracionMin };
    })
    .filter((s): s is { id: string; inicio: number; fin: number } => s !== null)
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);

  const result = new Map<string, LayoutEvento>();

  const volcarCluster = (grupo: { id: string; inicio: number; fin: number }[]) => {
    const columnas: number[] = []; // fin (min) del último evento en cada columna
    const colDe = new Map<string, number>();
    for (const s of grupo) {
      let asignada = columnas.findIndex((finCol) => finCol <= s.inicio);
      if (asignada === -1) {
        asignada = columnas.length;
        columnas.push(s.fin);
      } else {
        columnas[asignada] = s.fin;
      }
      colDe.set(s.id, asignada);
    }
    const total = columnas.length;
    for (const s of grupo) result.set(s.id, { col: colDe.get(s.id)!, cols: total });
  };

  let cluster: { id: string; inicio: number; fin: number }[] = [];
  let clusterFin = -Infinity;
  for (const s of segs) {
    if (cluster.length && s.inicio >= clusterFin) {
      volcarCluster(cluster);
      cluster = [];
      clusterFin = -Infinity;
    }
    cluster.push(s);
    clusterFin = Math.max(clusterFin, s.fin);
  }
  if (cluster.length) volcarCluster(cluster);

  return result;
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

// ─── Helpers de hora (HH:mm ↔ minutos desde medianoche) ──────
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function hmAMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minAHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
function fmtReloj(d: Date): string {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
function fmtDuracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
// Date local (zona del navegador) a las HH:mm del día indicado.
function fechaDesde(dayIso: string, min: number): Date {
  const d = new Date(`${dayIso}T00:00:00`);
  d.setMinutes(d.getMinutes() + min);
  return d;
}
// Recalcula los campos derivados de un evento tras moverlo/redimensionarlo.
function aplicarHorario(
  ev: Evento,
  dayIso: string,
  inicioMin: number,
  durMin: number,
): Evento {
  const start = fechaDesde(dayIso, inicioMin);
  const fin = new Date(start.getTime() + durMin * 60000);
  return {
    ...ev,
    inicio: start.toISOString(),
    fin: fin.toISOString(),
    hora: fmtReloj(start),
    duracion: fmtDuracion(durMin),
    fechaDia: isoDate(start),
    inicioMin: start.getHours() * 60 + start.getMinutes(),
    duracionMin: durMin,
  };
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
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } =
    useConfirmDelete();
  const [vista, setVista] = useState<Vista>("week");
  const [fechaRef, setFechaRef] = useState(new Date());
  const [calendarios, setCalendarios] = useState<GoogleCalendar[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [eventos, setEventos] = useState<Evento[]>(MOCK_EVENTOS);
  const [cargando, setCargando] = useState(false);
  const [eventoSel, setEventoSel] = useState<Evento | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(cargando || guardando);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [tzSecundaria, setTzSecundaria] = useState<string | null>(null);
  // Ancho real de la barra de scroll vertical del cuerpo de la rejilla.
  // Se reserva el mismo espacio en la cabecera de días y en la fila "Todo el día"
  // para que las 7 columnas no se desalineen (0 en sistemas con scrollbar overlay).
  const [scrollbarW, setScrollbarW] = useState(0);
  const [drag, setDrag] = useState<{
    dayIso: string;
    startMin: number;
    endMin: number;
  } | null>(null);
  // Mover / redimensionar un evento existente (arrastre del propio recuadro).
  const movRef = useRef<{
    evId: string;
    calendarId: string;
    modo: "mover" | "top" | "bottom";
    origDayIso: string;
    origInicioMin: number;
    origDurMin: number;
    startY: number;
    dragged: boolean;
    visMarked: boolean;
    prevDayIso: string;
    prevInicioMin: number;
    prevDurMin: number;
  } | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [moviendoVis, setMoviendoVis] = useState<string | null>(null);
  const clickSupRef = useRef(false);
  const nowTime = useNow();

  // Huso secundario guardado por usuario (persiste tras logout y entre
  // dispositivos). Lo cargamos al montar y lo guardamos al cambiarlo.
  useEffect(() => {
    loadUserPref(TZ_HORA_SECUNDARIA_KEY).then((v) => {
      if (v) setTzSecundaria(v);
    });
  }, []);
  const cambiarTz = (v: string | null) => {
    setTzSecundaria(v);
    saveUserPref(TZ_HORA_SECUNDARIA_KEY, v);
  };
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
    let cancelado = false;
    Promise.all([
      fetch("/api/google/calendar/list").then((r) => r.json()),
      loadCalendariosSeleccionados(),
    ])
      .then(([data, guardados]) => {
        if (cancelado) return;
        if (data.needsReauth || data.connected === false) {
          setNeedsReauth(true);
          setCalendarios([]);
          return;
        }
        if (data.connected && Array.isArray(data.calendarios)) {
          setNeedsReauth(false);
          setCalendarios(data.calendarios);
          const idsDisponibles = new Set<string>(
            data.calendarios.map((c: GoogleCalendar) => c.id),
          );
          // Si el usuario ya dejó una selección guardada, la respetamos
          // (filtrando calendarios que ya no existan). Solo en la primera vez
          // caemos a los que Google trae marcados / el principal.
          let initial: Set<string>;
          if (guardados) {
            initial = new Set(guardados.filter((id) => idsDisponibles.has(id)));
          } else {
            initial = new Set<string>(
              data.calendarios
                .filter((c: GoogleCalendar) => c.seleccionado || c.primary)
                .map((c: GoogleCalendar) => c.id),
            );
            if (initial.size === 0 && data.calendarios.length > 0) {
              initial.add(data.calendarios[0].id);
            }
          }
          setSeleccionados(initial);
        }
      })
      .catch(() => {
        if (!cancelado) setCalendarios([]);
      });
    return () => {
      cancelado = true;
    };
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

  // Callback-ref: al montar el contenedor scrollable, posiciona en la hora actual.
  // Funciona también al abrir el Sheet (portal monta el DOM en ese momento).
  const setScrollContainer = (el: HTMLDivElement | null) => {
    if (!el) return;
    const horaObjetivo = Math.max(0, Math.min(22, Math.floor(nowMinutes / 60) - 1));
    el.scrollTop = horaObjetivo * HORA_PX;
    // Mide el ancho que ocupa la barra de scroll para compensar la cabecera.
    const w = el.offsetWidth - el.clientWidth;
    setScrollbarW((prev) => (prev === w ? prev : w));
  };

  // Drag-to-create: mousedown en un slot, mousemove en la columna, mouseup abre el form.
  function handleSlotMouseDown(d: Date, h: number) {
    if (!connected) return;
    setDrag({ dayIso: isoDate(d), startMin: h * 60, endMin: h * 60 + 60 });
  }
  function handleColumnMouseMove(d: Date, e: React.MouseEvent<HTMLDivElement>) {
    if (!drag || drag.dayIso !== isoDate(d)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minBruto = Math.round((y / HORA_PX) * 4) * 15; // snap a 15 min
    const minClamp = Math.max(drag.startMin + 15, Math.min(24 * 60, minBruto));
    setDrag((cur) => (cur ? { ...cur, endMin: minClamp } : cur));
  }
  function handleColumnMouseUp() {
    if (!drag) return;
    const fmt = (m: number) =>
      `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
    const startMin = Math.min(drag.startMin, drag.endMin);
    const endMin = Math.max(drag.startMin + 15, drag.endMin);
    setForm({
      ...FORM_VACIO,
      calendarId: Array.from(seleccionados)[0] || "primary",
      fecha: drag.dayIso,
      inicio: fmt(startMin),
      fin: fmt(endMin),
    });
    setDrag(null);
  }
  // Si el mouseup ocurre fuera de la columna, cancelar el drag.
  useEffect(() => {
    if (!drag) return;
    const cancel = () => setDrag(null);
    window.addEventListener("mouseup", cancel);
    return () => window.removeEventListener("mouseup", cancel);
  }, [drag]);

  // Calendarios donde el usuario puede escribir (para permitir mover eventos).
  const calsWritable = useMemo(() => {
    const s = new Set<string>();
    calendarios.forEach((c) => {
      if (c.rol === "owner" || c.rol === "writer") s.add(c.id);
    });
    return s;
  }, [calendarios]);
  function puedeEditarEv(ev: Evento): boolean {
    return calsWritable.size === 0 || calsWritable.has(ev.calendarId);
  }

  // Mover el recuadro (cambia día/hora) o tirar de un borde (cambia duración).
  function iniciarMovimiento(
    ev: Evento,
    dayIso: string,
    modo: "mover" | "top" | "bottom",
    e: React.PointerEvent,
  ) {
    if (e.button !== 0 || !puedeEditarEv(ev)) return;
    const seg = segmentoEnDia(ev, dayIso);
    if (!seg || !seg.esInicio || !seg.esFin) return; // solo eventos de un único día
    e.preventDefault();
    e.stopPropagation();
    movRef.current = {
      evId: ev.id,
      calendarId: ev.calendarId,
      modo,
      origDayIso: dayIso,
      origInicioMin: seg.inicioMin,
      origDurMin: seg.duracionMin,
      startY: e.clientY,
      dragged: false,
      visMarked: false,
      prevDayIso: dayIso,
      prevInicioMin: seg.inicioMin,
      prevDurMin: seg.duracionMin,
    };
    setArrastrando(ev.id);
  }

  // Listeners globales mientras se arrastra un evento. Actualiza el estado
  // de forma optimista (snap a 15 min) y persiste en Google al soltar.
  useEffect(() => {
    if (!arrastrando) return;
    function onMove(e: PointerEvent) {
      const m = movRef.current;
      if (!m) return;
      const dy = e.clientY - m.startY;
      const deltaMin = Math.round((dy / HORA_PX) * 4) * 15; // snap a 15 min
      let dayIso = m.origDayIso;
      let inicioMin = m.origInicioMin;
      let durMin = m.origDurMin;
      if (m.modo === "mover") {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const col = el?.closest("[data-day]") as HTMLElement | null;
        if (col?.dataset.day) dayIso = col.dataset.day;
        inicioMin = clamp(m.origInicioMin + deltaMin, 0, 24 * 60 - m.origDurMin);
      } else if (m.modo === "bottom") {
        durMin = clamp(m.origDurMin + deltaMin, 15, 24 * 60 - m.origInicioMin);
      } else {
        inicioMin = clamp(m.origInicioMin + deltaMin, 0, m.origInicioMin + m.origDurMin - 15);
        durMin = m.origInicioMin + m.origDurMin - inicioMin;
      }
      if (deltaMin !== 0 || dayIso !== m.origDayIso) m.dragged = true;
      // Marca visual de arrastre (pointer-events:none) solo cuando hay movimiento real,
      // para no desviar el click de selección en un click simple.
      if (m.dragged && !m.visMarked) {
        m.visMarked = true;
        setMoviendoVis(m.evId);
      }
      if (dayIso === m.prevDayIso && inicioMin === m.prevInicioMin && durMin === m.prevDurMin) return;
      m.prevDayIso = dayIso;
      m.prevInicioMin = inicioMin;
      m.prevDurMin = durMin;
      setEventos((prev) =>
        prev.map((x) => (x.id === m.evId ? aplicarHorario(x, dayIso, inicioMin, durMin) : x)),
      );
    }
    async function onUp() {
      const m = movRef.current;
      setArrastrando(null);
      setMoviendoVis(null);
      movRef.current = null;
      if (!m || !m.dragged) return;
      clickSupRef.current = true; // evita que el click posterior abra el detalle
      const start = fechaDesde(m.prevDayIso, m.prevInicioMin);
      const fin = new Date(start.getTime() + m.prevDurMin * 60000);
      try {
        const res = await fetch("/api/google/calendar/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: m.evId,
            calendarId: m.calendarId,
            inicio: start.toISOString(),
            fin: fin.toISOString(),
          }),
        });
        if (!res.ok) throw new Error();
        toast.success("Evento actualizado");
      } catch {
        toast.error("No se pudo mover el evento");
        setEventos((prev) =>
          prev.map((x) =>
            x.id === m.evId ? aplicarHorario(x, m.origDayIso, m.origInicioMin, m.origDurMin) : x,
          ),
        );
        recargarEventos();
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastrando]);

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
      // Persistimos para que la selección se conserve en la próxima sesión.
      saveCalendariosSeleccionados(next);
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
    if (!form.allDay && hmAMin(form.fin) <= hmAMin(form.inicio)) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
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
    const ok = await confirmDelete({
      title: "¿Borrar evento?",
      description: `Se eliminará "${eventoSel.titulo}" de tu calendario.`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
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

  // Filtro de búsqueda (insensible a acentos y mayúsculas)
  const q = busqueda.trim().toLowerCase();
  function coincide(ev: Evento): boolean {
    if (!q) return true;
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return (
      norm(ev.titulo).includes(norm(q)) ||
      norm(ev.descripcion || "").includes(norm(q)) ||
      norm(ev.lugar || "").includes(norm(q))
    );
  }

  // Rueda del ratón sobre los campos de hora: ±15 min sin tener que pinchar.
  // Al mover el inicio se conserva la duración (arrastra el fin con él).
  const stepInicio = useCallback((dir: number) => {
    setForm((f) => {
      if (!f) return f;
      const ini = hmAMin(f.inicio);
      const dur = Math.max(15, hmAMin(f.fin) - ini);
      const nIni = clamp(ini + dir * 15, 0, 24 * 60 - 15);
      return { ...f, inicio: minAHM(nIni), fin: minAHM(Math.min(24 * 60, nIni + dur)) };
    });
  }, []);
  const stepFin = useCallback((dir: number) => {
    setForm((f) => {
      if (!f) return f;
      const ini = hmAMin(f.inicio);
      const nFin = clamp(hmAMin(f.fin) + dir * 15, ini + 15, 24 * 60);
      return { ...f, fin: minAHM(nFin) };
    });
  }, []);
  const horasInvalidas =
    !!form && !form.allDay && hmAMin(form.fin) <= hmAMin(form.inicio);

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
              <button
                type="button"
                onClick={() => setBuscadorAbierto((v) => !v)}
                className={cn(
                  "rounded-full p-3 transition-colors",
                  buscadorAbierto ? "bg-blue-100 text-blue-700" : "text-[#5f6368] hover:bg-black/5",
                )}
                title="Buscar eventos"
              >
                <Search className="h-5 w-5" />
              </button>
              <SelectorTZ tz={tzSecundaria} onChange={cambiarTz} />
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

        {buscadorAbierto && (
          <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por título, descripción o lugar…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                title="Limpiar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <span className="text-[11px] text-muted-foreground">
              {q ? `${eventos.filter(coincide).length} coincidencias` : ""}
            </span>
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
          {/* Sidebar de calendarios (compartido con el panel de Meet) */}
          {sidebarAbierto && (
            <CalendarSidebar
              calendarios={calendarios}
              seleccionados={seleccionados}
              onToggle={toggleCalendario}
              fechaRef={fechaRef}
              onSelectDate={(d) => setFechaRef(d)}
              nowIso={nowIso}
              connected={connected}
            />
          )}

          {/* VISTA WEEK */}
          {vista === "week" && (
            <div className="flex flex-1 min-h-0 flex-col">
              {/* Cabecera de días */}
              <div className="flex shrink-0 border-b bg-card" style={{ paddingRight: scrollbarW }}>
                <div
                  className="shrink-0 border-r flex items-end justify-around pb-1 text-[9px] uppercase text-muted-foreground"
                  style={{ width: tzSecundaria ? 104 : 52 }}
                >
                  {tzSecundaria ? (
                    <>
                      <span className="font-semibold">{labelTZLocal()}</span>
                      <span className="font-semibold">{shortTZLabel(tzSecundaria)}</span>
                    </>
                  ) : null}
                </div>
                {semanaActual.map((d, i) => {
                  const esHoy = d.toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setFechaRef(d);
                        setVista("day");
                      }}
                      className="flex-1 border-r px-1 py-1 text-center transition-colors hover:bg-muted/40"
                      title="Ver día"
                    >
                      <p className={cn(
                        "text-[10px] font-medium uppercase tracking-wider",
                        esHoy ? "text-blue-600" : "text-muted-foreground",
                      )}>
                        {DIAS_CORTO[i]}
                      </p>
                      <p
                        className={cn(
                          "mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                          esHoy ? "bg-blue-600 text-white" : "text-foreground",
                        )}
                      >
                        {d.getDate()}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Fila de all-day events */}
              {eventosAllDay.length > 0 && (
                <div className="flex shrink-0 border-b bg-muted/10" style={{ paddingRight: scrollbarW }}>
                  <div
                    className="shrink-0 border-r px-1 py-1 text-right text-[9px] uppercase text-muted-foreground"
                    style={{ width: tzSecundaria ? 104 : 52 }}
                  >
                    Todo&nbsp;el&nbsp;día
                  </div>
                  {semanaActual.map((d, i) => {
                    const dayIso = isoDate(d);
                    const evs = eventosAllDay.filter((e) => allDayCubreFecha(e, dayIso));
                    const diaPasado = dayIso < nowIso;
                    return (
                      <div key={i} className={cn(
                        "flex-1 min-w-0 min-h-[28px] border-r p-1 space-y-0.5",
                        diaPasado && "bg-muted/30",
                      )}>
                        {evs.map((ev) => (
                          <button
                            key={`${ev.id}-${dayIso}`}
                            onClick={() => setEventoSel(ev)}
                            className={cn(
                              "block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium",
                              diaPasado && "opacity-70",
                              q && !coincide(ev) && "opacity-20",
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
              <div ref={setScrollContainer} className="flex flex-1 min-h-0 overflow-y-auto">
                <ColumnaHoras tzSecundaria={tzSecundaria} fechaRef={fechaRef} />

                {semanaActual.map((d, diaIdx) => {
                  const dayIso = isoDate(d);
                  const diaPasado = dayIso < nowIso;
                  const esHoy = dayIso === nowIso;
                  const dragEnDia = drag?.dayIso === dayIso;
                  const dragTop = dragEnDia ? (Math.min(drag!.startMin, drag!.endMin) / 60) * HORA_PX : 0;
                  const dragHeight = dragEnDia ? (Math.abs(drag!.endMin - drag!.startMin) / 60) * HORA_PX : 0;
                  return (
                    <div
                      key={diaIdx}
                      data-day={dayIso}
                      className="relative flex flex-1 flex-col border-r"
                      style={{ height: GRID_PX }}
                      onMouseMove={(e) => handleColumnMouseMove(d, e)}
                      onMouseUp={handleColumnMouseUp}
                    >
                      {HORAS.map((h) => {
                        const slotPasado = diaPasado || (esHoy && (h + 1) * 60 <= nowMinutes);
                        return (
                          <div
                            key={h}
                            onMouseDown={() => handleSlotMouseDown(d, h)}
                            style={{ height: HORA_PX }}
                            className={cn(
                              "cursor-pointer border-b transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20",
                              slotPasado && "bg-muted/40",
                            )}
                          />
                        );
                      })}

                      {dragEnDia && dragHeight > 0 && (
                        <div
                          className="pointer-events-none absolute left-0.5 right-0.5 z-30 rounded bg-blue-500/30 ring-2 ring-blue-500"
                          style={{ top: dragTop, height: Math.max(8, dragHeight) }}
                        />
                      )}

                      {esHoy && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                          style={{ top: (nowMinutes / 60) * HORA_PX }}
                        >
                          <span className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                          <span className="flex-1 h-px bg-red-500" />
                        </div>
                      )}

                      {(() => {
                        const layout = calcularLayoutDia(eventosTimed, dayIso);
                        return eventosTimed.map((ev) => {
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
                        const lay = layout.get(ev.id) ?? { col: 0, cols: 1 };
                        const gap = 2; // px entre columnas solapadas
                        const left =
                          lay.cols > 1
                            ? `calc(${(lay.col / lay.cols) * 100}% + ${lay.col === 0 ? 2 : gap / 2}px)`
                            : undefined;
                        const right =
                          lay.cols > 1
                            ? `calc(${((lay.cols - lay.col - 1) / lay.cols) * 100}% + ${lay.col === lay.cols - 1 ? 2 : gap / 2}px)`
                            : undefined;
                        return (
                          <EventoBox
                            key={`${ev.id}-${dayIso}`}
                            ev={ev}
                            vista="week"
                            top={top}
                            height={height}
                            left={left}
                            right={right}
                            bg={bg}
                            txt={txt}
                            soloCol={lay.cols === 1}
                            esInicio={seg.esInicio}
                            esFin={seg.esFin}
                            finalizado={finalizado}
                            enCurso={enCurso}
                            atenuado={!!q && !coincide(ev)}
                            editable={puedeEditarEv(ev) && seg.esInicio && seg.esFin}
                            arrastrandoEste={moviendoVis === ev.id}
                            subLabel={seg.esInicio ? ev.hora : "continúa"}
                            mostrarLugar={false}
                            onSelect={() => {
                              if (clickSupRef.current) {
                                clickSupRef.current = false;
                                return;
                              }
                              setEventoSel(ev);
                            }}
                            onIniciarMov={(modo, e) => iniciarMovimiento(ev, dayIso, modo, e)}
                          />
                        );
                        });
                      })()}
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
              {/* Rótulo de los dos husos sobre la columna de horas (vista día) */}
              {tzSecundaria && (
                <div className="flex shrink-0 border-b bg-card">
                  <div
                    className="shrink-0 border-r flex items-end justify-around pb-1 text-[9px] uppercase text-muted-foreground"
                    style={{ width: 104 }}
                  >
                    <span className="font-semibold">{labelTZLocal()}</span>
                    <span className="font-semibold">{shortTZLabel(tzSecundaria)}</span>
                  </div>
                  <div className="flex-1" />
                </div>
              )}
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
                          q && !coincide(ev) && "opacity-20",
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

              <div ref={setScrollContainer} className="flex flex-1 min-h-0 overflow-y-auto">
                <ColumnaHoras tzSecundaria={tzSecundaria} fechaRef={fechaRef} />
                <div
                  data-day={dayIso}
                  className="relative flex flex-1 flex-col border-r"
                  style={{ height: GRID_PX }}
                  onMouseMove={(e) => handleColumnMouseMove(fechaRef, e)}
                  onMouseUp={handleColumnMouseUp}
                >
                  {HORAS.map((h) => {
                    const slotPasado = diaPasado || (esHoy && (h + 1) * 60 <= nowMinutes);
                    return (
                      <div
                        key={h}
                        onMouseDown={() => handleSlotMouseDown(fechaRef, h)}
                        style={{ height: HORA_PX }}
                        className={cn(
                          "cursor-pointer border-b transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20",
                          slotPasado && "bg-muted/40",
                        )}
                      />
                    );
                  })}

                  {drag?.dayIso === dayIso && (
                    <div
                      className="pointer-events-none absolute left-1 right-1 z-30 rounded bg-blue-500/30 ring-2 ring-blue-500"
                      style={{
                        top: (Math.min(drag.startMin, drag.endMin) / 60) * HORA_PX,
                        height: Math.max(8, (Math.abs(drag.endMin - drag.startMin) / 60) * HORA_PX),
                      }}
                    />
                  )}

                  {esHoy && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: (nowMinutes / 60) * HORA_PX }}
                    >
                      <span className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                      <span className="flex-1 h-px bg-red-500" />
                    </div>
                  )}

                  {(() => {
                    const layout = calcularLayoutDia(eventosTimed, dayIso);
                    return eventosTimed.map((ev) => {
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
                    const lay = layout.get(ev.id) ?? { col: 0, cols: 1 };
                    const gap = 3; // px entre columnas solapadas
                    const left =
                      lay.cols > 1
                        ? `calc(${(lay.col / lay.cols) * 100}% + ${lay.col === 0 ? 4 : gap / 2}px)`
                        : undefined;
                    const right =
                      lay.cols > 1
                        ? `calc(${((lay.cols - lay.col - 1) / lay.cols) * 100}% + ${lay.col === lay.cols - 1 ? 4 : gap / 2}px)`
                        : undefined;
                    return (
                      <EventoBox
                        key={`${ev.id}-${dayIso}`}
                        ev={ev}
                        vista="day"
                        top={top}
                        height={height}
                        left={left}
                        right={right}
                        bg={bg}
                        txt={txt}
                        soloCol={lay.cols === 1}
                        esInicio={seg.esInicio}
                        esFin={seg.esFin}
                        finalizado={finalizado}
                        enCurso={enCurso}
                        atenuado={!!q && !coincide(ev)}
                        editable={puedeEditarEv(ev) && seg.esInicio && seg.esFin}
                        arrastrandoEste={moviendoVis === ev.id}
                        subLabel={seg.esInicio ? `${ev.hora} · ${ev.duracion}` : "continúa"}
                        mostrarLugar
                        onSelect={() => {
                          if (clickSupRef.current) {
                            clickSupRef.current = false;
                            return;
                          }
                          setEventoSel(ev);
                        }}
                        onIniciarMov={(modo, e) => iniciarMovimiento(ev, dayIso, modo, e)}
                      />
                    );
                    });
                  })()}
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
                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px]">Inicio</Label>
                        <TimeInput
                          value={form.inicio}
                          onChange={(v) => setForm({ ...form, inicio: v })}
                          onStep={stepInicio}
                          invalido={horasInvalidas}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Fin</Label>
                        <TimeInput
                          value={form.fin}
                          onChange={(v) => setForm({ ...form, fin: v })}
                          onStep={stepFin}
                          invalido={horasInvalidas}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {horasInvalidas && (
                      <p className="mt-1.5 text-[11px] text-destructive">
                        La hora de fin debe ser posterior a la de inicio.
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Gira la rueda del ratón sobre la hora para ajustarla.
                    </p>
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
                  disabled={guardando || horasInvalidas}
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
        {confirmDeleteDialog}
      </SheetContent>
    </Sheet>
  );
}

// ─── Campo de hora con rueda del ratón (±15 min sin pinchar) ──
function TimeInput({
  value,
  onChange,
  onStep,
  invalido,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onStep: (dir: number) => void;
  invalido?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Listener no pasivo: React monta wheel como pasivo y no deja preventDefault.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      onStep(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onStep]);
  return (
    <Input
      ref={ref}
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(invalido && "border-destructive focus-visible:ring-destructive", className)}
    />
  );
}

// ─── Recuadro de evento (arrastrable y redimensionable) ──────
type EventoBoxProps = {
  ev: Evento;
  vista: "week" | "day";
  top: number;
  height: number;
  left?: string;
  right?: string;
  bg: string;
  txt: string;
  soloCol: boolean;
  esInicio: boolean;
  esFin: boolean;
  finalizado: boolean;
  enCurso: boolean;
  atenuado: boolean;
  editable: boolean;
  arrastrandoEste: boolean;
  subLabel: string;
  mostrarLugar: boolean;
  onSelect: () => void;
  onIniciarMov: (modo: "mover" | "top" | "bottom", e: React.PointerEvent) => void;
};

function EventoBox({
  ev,
  vista,
  top,
  height,
  left,
  right,
  bg,
  txt,
  soloCol,
  esInicio,
  esFin,
  finalizado,
  enCurso,
  atenuado,
  editable,
  arrastrandoEste,
  subLabel,
  mostrarLugar,
  onSelect,
  onIniciarMov,
}: EventoBoxProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(e) => onIniciarMov("mover", e)}
      onClick={onSelect}
      className={cn(
        "absolute z-10 select-none overflow-hidden text-left leading-tight transition-shadow hover:z-20 hover:shadow-md",
        vista === "week" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        soloCol && (vista === "week" ? "left-0.5 right-0.5" : "left-1 right-1"),
        esInicio && "rounded-t-[4px]",
        esFin && "rounded-b-[4px]",
        finalizado && "opacity-70",
        enCurso && "ring-2 ring-red-400",
        atenuado && "opacity-20",
        editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        arrastrandoEste && "pointer-events-none opacity-90 shadow-lg ring-2 ring-blue-400",
      )}
      style={{ top, height, left, right, backgroundColor: bg, color: txt }}
    >
      {editable && esInicio && (
        <div
          onPointerDown={(e) => onIniciarMov("top", e)}
          className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize"
          title="Cambiar hora de inicio"
        />
      )}
      <p className="truncate font-semibold">{ev.titulo}</p>
      <p className="truncate text-[10px] opacity-90">{subLabel}</p>
      {mostrarLugar && ev.lugar && (
        <p className="truncate text-[10px] opacity-90">📍 {ev.lugar}</p>
      )}
      {editable && esFin && (
        <div
          onPointerDown={(e) => onIniciarMov("bottom", e)}
          className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize"
          title="Cambiar hora de fin"
        />
      )}
    </div>
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

// ─── Columna de horas (con huso secundario opcional) ────────
function ColumnaHoras({
  tzSecundaria,
  fechaRef,
}: {
  tzSecundaria: string | null;
  fechaRef: Date;
}) {
  return (
    <div
      className="flex shrink-0 flex-col border-r"
      style={{ width: tzSecundaria ? 104 : 52, height: GRID_PX }}
    >
      {HORAS.map((h) => (
        <div
          key={h}
          style={{ height: HORA_PX }}
          className="flex items-start justify-end border-b text-[10px] text-muted-foreground"
        >
          <div className="flex h-full w-[52px] items-start justify-end px-2 pt-0.5">
            {h.toString().padStart(2, "0")}:00
          </div>
          {tzSecundaria && (
            <div className="flex h-full w-[52px] items-start justify-end border-l px-2 pt-0.5 text-muted-foreground/70">
              {horaEnTZ(h, tzSecundaria, fechaRef)}
            </div>
          )}
        </div>
      ))}
    </div>
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
