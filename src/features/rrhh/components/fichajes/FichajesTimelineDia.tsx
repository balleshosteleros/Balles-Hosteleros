"use client";

/**
 * Timeline de fichajes por DÍA (estilo Sesame). Regla horaria 0–24h arriba y una
 * fila por empleado: avatar + nombre · fichado/previsto · barra gris (previsto) +
 * barras de color (verde=normal directo, azul=normal por solicitud, rojo=extra
 * por solicitud). Fuente de datos: loadTimelineDia.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRangeNav } from "@/shared/components/calendar/CalendarRangeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  loadTimelineDia,
  type TimelineFichajeRow,
  type TramoFichado,
  type TramoPrevisto,
} from "@/features/rrhh/actions/horas-actions";

const MIN_DIA = 1440;
// Horas visibles de la regla (cabe scroll horizontal si hace falta).
const HORAS = Array.from({ length: 25 }, (_, i) => i); // 0..24

function hhmmAMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function pos(iniMin: number, finMin: number | null): { left: string; width: string } {
  const fin = finMin == null ? iniMin + 30 : finMin <= iniMin ? finMin + MIN_DIA : finMin;
  const dur = Math.min(fin - iniMin, MIN_DIA - iniMin);
  return {
    left: `${(iniMin / MIN_DIA) * 100}%`,
    width: `${Math.max((dur / MIN_DIA) * 100, 0.8)}%`,
  };
}

function colorFichado(t: TramoFichado): string {
  if (t.extra) return "bg-rose-500";
  if (t.origen === "solicitud") return "bg-sky-500";
  return "bg-emerald-500";
}

/** "8h 30min" a partir de horas decimales. */
function fmtHM(h: number): string {
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  return min === 0 ? `${horas}h 00min` : `${horas}h ${String(min).padStart(2, "0")}min`;
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_SEM = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function labelDia(d: Date): string {
  return `${DIAS_SEM[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function FichajesTimelineDia() {
  const { empresaActual } = useEmpresa();
  const router = useRouter();
  const [fecha, setFecha] = useState<Date>(() => new Date());
  const [rows, setRows] = useState<TimelineFichajeRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [superponer, setSuperponer] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const fechaISO = useMemo(() => toISO(fecha), [fecha]);
  const hoyISO = useMemo(() => toISO(new Date()), []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void loadTimelineDia(fechaISO).then((r) => {
      if (!vivo) return;
      setRows(r.ok ? r.data : []);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [fechaISO, empresaActual.id]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? rows.filter((r) => r.nombre.toLowerCase().includes(q)) : rows;
  }, [rows, busqueda]);

  const cambiarDia = (delta: number) => {
    setFecha((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  return (
    <TooltipProvider delayDuration={100}>
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar empleado"
          className="h-9 w-52 rounded-md border bg-background px-3 text-sm"
        />
        <div className="flex items-center gap-2">
          <Switch id="superponer" checked={superponer} onCheckedChange={setSuperponer} />
          <Label htmlFor="superponer" className="text-sm">Superponer horario</Label>
        </div>
        <div className="ml-auto">
          <CalendarRangeNav
            label={labelDia(fecha)}
            onPrev={() => cambiarDia(-1)}
            onNext={() => cambiarDia(1)}
            onToday={() => setFecha(new Date())}
            isToday={fechaISO === hoyISO}
          />
        </div>
      </div>

      {/* Rejilla timeline */}
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[900px]">
          {/* Cabecera: Empleado | Horas | regla 0-24 */}
          <div className="flex items-center border-b bg-muted/40 text-[11px] text-muted-foreground">
            <div className="w-48 shrink-0 px-4 py-2 font-medium">Empleado</div>
            <div className="w-28 shrink-0 px-2 py-2 font-medium">Horas</div>
            <div className="relative flex-1 border-r">
              <div className="flex">
                {HORAS.slice(0, 24).map((h) => (
                  <div key={h} className="flex-1 border-l py-2 pl-1 tabular-nums">
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
              </div>
              {/* Cierre de las 24:00 a la derecha */}
              <span className="absolute right-0 top-2 -mr-2 tabular-nums">24</span>
            </div>
          </div>

          {/* Filas */}
          {cargando ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : filas.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay empleados en este día.
            </div>
          ) : (
            filas.map((r) => (
              <div key={r.empleadoId} className="flex items-center border-b last:border-b-0 hover:bg-muted/20">
                {/* Empleado (clic → su ficha con todos sus fichajes) */}
                <button
                  type="button"
                  onClick={() => router.push(`/rrhh/empleados/${r.empleadoId}`)}
                  className="flex w-48 shrink-0 items-center gap-2 px-4 py-3 text-left hover:underline"
                  title="Ver la ficha y todos sus fichajes"
                >
                  <Avatar className="h-8 w-8">
                    {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt={r.nombre} /> : null}
                    <AvatarFallback className="text-[10px]">{iniciales(r.nombre)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{r.nombre}</span>
                </button>
                {/* Horas fichado / previsto */}
                <div className="w-28 shrink-0 px-2 py-3 text-xs">
                  <span className="font-semibold tabular-nums">{fmtHM(r.horasFichadas)}</span>
                  <span className="text-muted-foreground tabular-nums"> / {fmtHM(r.horasPrevistas)}</span>
                </div>
                {/* Barra */}
                <div className="relative flex-1 px-0 py-3">
                  <div className="relative h-4 w-full border-r border-muted/40">
                    {/* Líneas de hora de fondo (24 columnas = 24 horas completas) */}
                    <div className="absolute inset-0 flex">
                      {HORAS.slice(0, 24).map((h) => (
                        <div key={h} className="flex-1 border-l border-muted/40" />
                      ))}
                    </div>
                    {/* Fichado (color), GRUESO y debajo. Tooltip con tipo + horario realizado. */}
                    {r.fichado.map((t, i) => {
                      const ini = hhmmAMin(t.horaInicio);
                      if (ini == null) return null;
                      const { left, width } = pos(ini, hhmmAMin(t.horaFin));
                      const etiquetaTipo = t.extra
                        ? "Fichaje horas extras"
                        : t.origen === "solicitud"
                          ? "Fichaje normal (por solicitud)"
                          : "Fichaje normal";
                      return (
                        <Tooltip key={`f-${i}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-1/2 z-10 h-3 -translate-y-1/2 cursor-help rounded-full ${colorFichado(t)}`}
                              style={{ left, width }}
                            />
                          </TooltipTrigger>
                          <TooltipContent className="text-center">
                            <div className="font-semibold">{etiquetaTipo}</div>
                            <div className="tabular-nums">
                              {t.horaInicio} – {t.horaFin ?? "en curso"}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {/* Previsto (gris) ENCIMA, fino: referencia sin tapar el color.
                        Tooltip con nombre del turno + horas + horario estimado. */}
                    {superponer &&
                      r.previsto.map((tr, i) => {
                        const ini = hhmmAMin(tr.inicio);
                        const fin = hhmmAMin(tr.fin);
                        if (ini == null || fin == null) return null;
                        const { left, width } = pos(ini, fin);
                        let dur = fin - ini;
                        if (dur < 0) dur += 1440;
                        return (
                          <Tooltip key={`p-${i}`}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute top-1/2 z-20 h-1.5 -translate-y-1/2 cursor-help rounded-full bg-zinc-400/80 ring-1 ring-white/60"
                                style={{ left, width }}
                              />
                            </TooltipTrigger>
                            <TooltipContent className="text-center">
                              {tr.turnoNombre && <div className="font-semibold uppercase">{tr.turnoNombre}</div>}
                              <div className="text-muted-foreground">turno · {fmtHM(dur / 60)}</div>
                              <div className="tabular-nums">{tr.inicio} – {tr.fin}</div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {[
          { c: "bg-muted-foreground/25", l: "Previsto (horario)" },
          { c: "bg-emerald-500", l: "Fichado normal" },
          { c: "bg-sky-500", l: "Normal por solicitud" },
          { c: "bg-rose-500", l: "Extra por solicitud" },
        ].map((it) => (
          <span key={it.l} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-4 rounded-full ${it.c}`} />
            {it.l}
          </span>
        ))}
      </div>
    </div>
    </TooltipProvider>
  );
}
