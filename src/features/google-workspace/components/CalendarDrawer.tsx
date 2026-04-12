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
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { useGoogleConnection } from "./useGoogleConnection";

type Evento = {
  id: string;
  titulo: string;
  hora: string;
  duracion: string;
  lugar?: string;
  participantes?: string[];
  color: "blue" | "emerald" | "orange" | "violet" | "red";
  diaIndex: number; // 0-6
  inicioMin: number; // minutos desde 0
  duracionMin: number;
};

const HORA_INICIO = 7;
const HORA_FIN = 22;
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => i + HORA_INICIO);
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const COLOR_MAP: Record<Evento["color"], string> = {
  blue: "bg-blue-500/90 border-blue-700 text-white",
  emerald: "bg-emerald-500/90 border-emerald-700 text-white",
  orange: "bg-orange-500/90 border-orange-700 text-white",
  violet: "bg-violet-500/90 border-violet-700 text-white",
  red: "bg-red-500/90 border-red-700 text-white",
};

const MOCK_EVENTOS: Evento[] = [
  {
    id: "e1",
    titulo: "Reunión de gerencia",
    hora: "09:00",
    duracion: "1h",
    lugar: "Sala de juntas",
    participantes: ["Iván", "Pablo", "Marta"],
    color: "blue",
    diaIndex: 0,
    inicioMin: 9 * 60,
    duracionMin: 60,
  },
  {
    id: "e2",
    titulo: "Visita técnica frigorífico",
    hora: "10:30",
    duracion: "1h 30m",
    lugar: "Cocina principal",
    color: "orange",
    diaIndex: 3,
    inicioMin: 10 * 60 + 30,
    duracionMin: 90,
  },
  {
    id: "e3",
    titulo: "Cata de nuevos platos",
    hora: "12:00",
    duracion: "2h",
    lugar: "Sala",
    participantes: ["Equipo cocina", "Equipo sala"],
    color: "emerald",
    diaIndex: 1,
    inicioMin: 12 * 60,
    duracionMin: 120,
  },
  {
    id: "e4",
    titulo: "Cierre semanal contabilidad",
    hora: "16:00",
    duracion: "1h",
    color: "violet",
    diaIndex: 4,
    inicioMin: 16 * 60,
    duracionMin: 60,
  },
  {
    id: "e5",
    titulo: "Pedido proveedor Hermanos Ruiz",
    hora: "08:00",
    duracion: "30m",
    color: "red",
    diaIndex: 2,
    inicioMin: 8 * 60,
    duracionMin: 30,
  },
];

interface CalendarDrawerProps {
  children: ReactNode;
}

function getRangoSemana() {
  const hoy = new Date();
  const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; // lunes = 0
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - dia);
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(inicio)} – ${fmt(fin)}`;
}

export function CalendarDrawer({ children }: CalendarDrawerProps) {
  const { connected } = useGoogleConnection();
  const [eventoSel, setEventoSel] = useState<Evento | null>(null);
  const [eventosReales, setEventosReales] = useState<Evento[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const rango = useMemo(() => getRangoSemana(), []);

  // Carga eventos reales de Google Calendar cuando hay sesión
  useEffect(() => {
    if (!connected) {
      setEventosReales(null);
      return;
    }
    setCargando(true);
    fetch("/api/google/calendar/events")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && Array.isArray(data.eventos)) {
          setEventosReales(data.eventos as Evento[]);
        }
      })
      .catch(() => setEventosReales([]))
      .finally(() => setCargando(false));
  }, [connected]);

  const eventos = eventosReales ?? MOCK_EVENTOS;

  const PIXELS_POR_HORA = 56;

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-6xl flex flex-col gap-0 p-0 sm:max-w-6xl"
      >
        <SheetHeader className="border-b px-5 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            Calendario · Google Calendar
            <Badge variant="secondary" className="ml-1 text-[10px]">
              Vista semana
            </Badge>
            {cargando && (
              <span className="ml-2 text-[10px] text-muted-foreground">
                Cargando…
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {!connected && (
          <div className="border-b bg-muted/30 px-5 py-3">
            <GoogleConnectBanner servicio="Google Calendar" />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Hoy
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-semibold capitalize text-foreground">
              {rango}
            </span>
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-1 h-3.5 w-3.5" /> Crear evento
          </Button>
        </div>

        {/* Grid semanal */}
        <div className="flex-1 overflow-auto">
          <div className="grid min-w-[800px] grid-cols-[60px_repeat(7,1fr)]">
            {/* Cabecera días */}
            <div className="sticky top-0 z-10 border-b border-r bg-card" />
            {DIAS.map((dia, i) => (
              <div
                key={dia}
                className="sticky top-0 z-10 border-b border-r bg-card px-2 py-2 text-center"
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {dia}
                </p>
                <p className="text-base font-bold text-foreground">{i + 13}</p>
              </div>
            ))}

            {/* Filas de horas */}
            {HORAS.map((h) => (
              <div key={h} className="contents">
                <div
                  className="border-b border-r px-2 text-right text-[10px] text-muted-foreground"
                  style={{ height: PIXELS_POR_HORA }}
                >
                  {h.toString().padStart(2, "0")}:00
                </div>
                {DIAS.map((_, di) => (
                  <div
                    key={`${h}-${di}`}
                    className="relative border-b border-r"
                    style={{ height: PIXELS_POR_HORA }}
                  />
                ))}
              </div>
            ))}

            {/* Eventos posicionados absolutamente */}
            {eventos.map((ev) => {
              const top =
                ((ev.inicioMin - HORA_INICIO * 60) / 60) * PIXELS_POR_HORA;
              const height = (ev.duracionMin / 60) * PIXELS_POR_HORA - 2;
              const colStart = ev.diaIndex + 2; // +1 col horas, +1 base 1
              return (
                <button
                  key={ev.id}
                  onClick={() => setEventoSel(ev)}
                  className={cn(
                    "absolute z-10 mx-1 rounded-md border-l-4 px-2 py-1 text-left text-[11px] shadow-sm hover:shadow-md transition-shadow",
                    COLOR_MAP[ev.color],
                  )}
                  style={{
                    top: top + 36, // offset cabecera
                    height,
                    gridColumnStart: colStart,
                    gridRowStart: 2,
                    left: `calc(60px + ((100% - 60px) / 7) * ${ev.diaIndex} + 4px)`,
                    width: `calc((100% - 60px) / 7 - 8px)`,
                    position: "absolute",
                  }}
                >
                  <p className="truncate font-bold">{ev.titulo}</p>
                  <p className="truncate opacity-90">{ev.hora}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalles del evento */}
        {eventoSel && (
          <div className="border-t bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground">
                  {eventoSel.titulo}
                </h3>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> {eventoSel.hora} ·{" "}
                    {eventoSel.duracion}
                  </p>
                  {eventoSel.lugar && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> {eventoSel.lugar}
                    </p>
                  )}
                  {eventoSel.participantes && (
                    <p className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />{" "}
                      {eventoSel.participantes.join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEventoSel(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
