"use client";

import { useMemo } from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  horaEnTZ,
  labelTZLocal,
  shortTZLabel,
} from "../lib/timezones";

// Rejilla de calendario (día / semana / mes) en modo "foco Meet": las reuniones
// con Google Meet se pintan resaltadas con el color de su calendario; el resto
// de eventos se atenúan en gris (o se ocultan con `soloMeet`) para no competir
// con lo que de verdad importa en el panel de Meet.

export type EventoGrid = {
  id: string;
  calendarId: string;
  calendarNombre?: string;
  calendarColorHex?: string;
  titulo: string;
  hora: string;
  duracion: string;
  lugar?: string;
  participantes?: string[];
  allDay: boolean;
  inicio: string; // ISO
  fin: string; // ISO
  fechaDia: string; // YYYY-MM-DD
  meetLink?: string | null;
};

const FALLBACK_COLOR = "#039be5";
const GRIS_BG = "#e5e7eb"; // gray-200
const GRIS_TXT = "#6b7280"; // gray-500

const HORA_PX = 48;
const HORAS = Array.from({ length: 24 }, (_, i) => i);
const GRID_PX = HORAS.length * HORA_PX; // 1152
const DIAS_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_LARGO = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function getInicioSemana(base: Date): Date {
  const hoy = new Date(base);
  const dia = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - dia);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
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

type SegmentoDia = {
  inicioMin: number;
  duracionMin: number;
  esInicio: boolean;
  esFin: boolean;
};

function segmentoEnDia(ev: EventoGrid, dayIso: string): SegmentoDia | null {
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

function calcularLayoutDia(eventos: EventoGrid[], dayIso: string): Map<string, LayoutEvento> {
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
    const columnas: number[] = [];
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

function allDayCubreFecha(ev: EventoGrid, dayIso: string): boolean {
  if (!ev.allDay) return false;
  const startDate = ev.inicio.slice(0, 10);
  const endDate = ev.fin.slice(0, 10);
  if (startDate === endDate) return dayIso === startDate;
  return dayIso >= startDate && dayIso < endDate;
}

const esMeet = (ev: EventoGrid) => !!ev.meetLink;
const colorMeet = (ev: EventoGrid) => ev.calendarColorHex || FALLBACK_COLOR;

interface Props {
  eventos: EventoGrid[];
  vista: "dia" | "semana" | "mes";
  refDate: string; // YYYY-MM-DD
  nowTime: number;
  onAbrir: (ev: EventoGrid) => void;
  tzSecundaria?: string | null;
}

export function MeetCalendarGrid({
  eventos,
  vista,
  refDate,
  nowTime,
  onAbrir,
  tzSecundaria = null,
}: Props) {
  const base = useMemo(() => {
    const d = new Date(`${refDate}T00:00:00`);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [refDate]);

  const nowIso = isoDate(new Date(nowTime));
  const nowMinutes = useMemo(() => {
    const d = new Date(nowTime);
    return d.getHours() * 60 + d.getMinutes();
  }, [nowTime]);

  const visibles = useMemo(
    // Norma fija: las reuniones con Meet se resaltan y el resto siempre se
    // atenúa en gris. Nunca mostramos eventos de "todo el día".
    () => eventos.filter((e) => !e.allDay),
    [eventos],
  );
  const timed = visibles;

  // Al montar el contenedor scrollable, posiciona en la hora actual.
  const setScrollContainer = (el: HTMLDivElement | null) => {
    if (!el) return;
    const objetivo = Math.max(0, Math.min(22, Math.floor(nowMinutes / 60) - 1));
    el.scrollTop = objetivo * HORA_PX;
  };

  if (vista === "mes") {
    return (
      <VistaMes
        base={base}
        eventos={visibles}
        nowIso={nowIso}
        nowTime={nowTime}
        onAbrir={onAbrir}
      />
    );
  }

  const dias =
    vista === "semana"
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(getInicioSemana(base));
          d.setDate(d.getDate() + i);
          return d;
        })
      : [base];
  const single = vista === "dia";

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Cabecera: en semana muestra los 7 días; en día solo aparece para
          rotular los nombres de los dos husos sobre la columna de horas. */}
      {(!single || tzSecundaria) && (
        <div className="flex shrink-0 border-b bg-card">
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
          {single ? (
            <div className="flex-1" />
          ) : (
          dias.map((d, i) => {
            const esHoy = isoDate(d) === nowIso;
            return (
              <div key={i} className="flex-1 border-r px-1 py-1 text-center">
                <p
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wider",
                    esHoy ? "text-emerald-600" : "text-muted-foreground",
                  )}
                >
                  {DIAS_CORTO[i]}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    esHoy ? "bg-emerald-600 text-white" : "text-foreground",
                  )}
                >
                  {d.getDate()}
                </p>
              </div>
            );
          })
          )}
        </div>
      )}

      {/* Rejilla horaria 24 h */}
      <div ref={setScrollContainer} className="flex flex-1 min-h-0 overflow-y-auto">
        <div
          className="shrink-0 border-r"
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
                  {horaEnTZ(h, tzSecundaria, base)}
                </div>
              )}
            </div>
          ))}
        </div>

        {dias.map((d, diaIdx) => {
          const dayIso = isoDate(d);
          const diaPasado = dayIso < nowIso;
          const esHoy = dayIso === nowIso;
          return (
            <div
              key={diaIdx}
              className="relative flex flex-1 flex-col border-r"
              style={{ height: GRID_PX }}
            >
              {HORAS.map((h) => {
                const slotPasado =
                  diaPasado || (esHoy && (h + 1) * 60 <= nowMinutes);
                return (
                  <div
                    key={h}
                    style={{ height: HORA_PX }}
                    className={cn("border-b", slotPasado && "bg-muted/40")}
                  />
                );
              })}

              {esHoy && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                  style={{ top: (nowMinutes / 60) * HORA_PX }}
                >
                  <span className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
                  <span className="h-px flex-1 bg-red-500" />
                </div>
              )}

              {(() => {
                const layout = calcularLayoutDia(timed, dayIso);
                return timed.map((ev) => {
                const seg = segmentoEnDia(ev, dayIso);
                if (!seg) return null;
                const top = (seg.inicioMin / 60) * HORA_PX;
                const height = Math.max(
                  single ? 24 : 18,
                  (seg.duracionMin / 60) * HORA_PX - 2,
                );
                const meet = esMeet(ev);
                const bg = meet ? colorMeet(ev) : GRIS_BG;
                const txt = meet ? textOnColor(bg) : GRIS_TXT;
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
                  <button
                    key={`${ev.id}-${dayIso}`}
                    type="button"
                    onClick={() => meet && onAbrir(ev)}
                    disabled={!meet}
                    className={cn(
                      "absolute overflow-hidden px-1.5 py-0.5 text-left text-[11px] leading-tight",
                      lay.cols === 1 && "left-0.5 right-0.5",
                      seg.esInicio && "rounded-t-[4px]",
                      seg.esFin && "rounded-b-[4px]",
                      meet
                        ? "z-10 cursor-pointer transition-shadow hover:z-20 hover:shadow-md"
                        : "z-0 cursor-default border border-dashed border-gray-300 opacity-60",
                      finalizado && meet && "opacity-70",
                      enCurso && meet && "ring-2 ring-emerald-400",
                    )}
                    style={{ top, height, left, right, backgroundColor: bg, color: txt }}
                  >
                    <p className="flex items-center gap-1 truncate font-semibold">
                      {meet && <Video className="h-3 w-3 shrink-0" />}
                      {ev.titulo}
                    </p>
                    {height > 28 && (
                      <p className="truncate text-[10px] opacity-90">
                        {seg.esInicio ? ev.hora : "continúa"}
                      </p>
                    )}
                  </button>
                );
                });
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vista Mes ───────────────────────────────────────────────
function VistaMes({
  base,
  eventos,
  nowIso,
  nowTime,
  onAbrir,
}: {
  base: Date;
  eventos: EventoGrid[];
  nowIso: string;
  nowTime: number;
  onAbrir: (ev: EventoGrid) => void;
}) {
  const año = base.getFullYear();
  const mes = base.getMonth();
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
            className="truncate border-r px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const dayIso = isoDate(d);
          const esHoy = dayIso === nowIso;
          const esMesActual = d.getMonth() === base.getMonth();
          const diaPasado = esMesActual && dayIso < nowIso;
          const evs = eventos.filter((e) =>
            e.allDay
              ? allDayCubreFecha(e, dayIso)
              : segmentoEnDia(e, dayIso) !== null,
          );
          return (
            <div
              key={i}
              className={cn(
                "min-h-[84px] border-b border-r p-1",
                !esMesActual && "bg-muted/20 text-muted-foreground",
                diaPasado && "bg-muted/30",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    esHoy && "bg-emerald-600 text-white",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {evs.slice(0, 3).map((ev) => {
                  const meet = esMeet(ev);
                  const continua = !ev.allDay && ev.fechaDia !== dayIso;
                  const bg = meet ? colorMeet(ev) : GRIS_BG;
                  const txt = meet ? textOnColor(bg) : GRIS_TXT;
                  const finalizado = new Date(ev.fin).getTime() <= nowTime;
                  return (
                    <button
                      key={`${ev.id}-${dayIso}`}
                      type="button"
                      onClick={() => meet && onAbrir(ev)}
                      disabled={!meet}
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
                        meet
                          ? "cursor-pointer hover:shadow-sm"
                          : "cursor-default border border-dashed border-gray-300 opacity-60",
                        finalizado && meet && "opacity-70",
                      )}
                      style={{ backgroundColor: bg, color: txt }}
                    >
                      {meet && <Video className="h-2.5 w-2.5 shrink-0" />}
                      <span className="truncate">
                        {ev.allDay || continua ? "" : `${ev.hora} `}
                        {ev.titulo}
                      </span>
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
