"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CronogramaOperativo } from "../../hooks/useCronogramasOperativos";

const DIAS = [
  { iso: 1, short: "Lun", largo: "Lunes" },
  { iso: 2, short: "Mar", largo: "Martes" },
  { iso: 3, short: "Mié", largo: "Miércoles" },
  { iso: 4, short: "Jue", largo: "Jueves" },
  { iso: 5, short: "Vie", largo: "Viernes" },
  { iso: 6, short: "Sáb", largo: "Sábado" },
  { iso: 7, short: "Dom", largo: "Domingo" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

interface Grupo {
  main: CronogramaOperativo;
  subs: CronogramaOperativo[];
}

type SubVista = "DIARIO" | "SEMANAL" | "MENSUAL";

interface Props {
  grupos: Grupo[];
  onTareaClick: (t: CronogramaOperativo) => void;
}

interface CtxFecha {
  tareasSemanales: CronogramaOperativo[];
  tareasMensuales: CronogramaOperativo[];
  tareasTrimestrales: CronogramaOperativo[];
  tareasAnuales: CronogramaOperativo[];
}

function isoOfDate(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function startOfWeekMon(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const iso = isoOfDate(out);
  out.setDate(out.getDate() - (iso - 1));
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// Filtros intervalo + termina (espejo del seeder seed_cronograma_ejecuciones)
function pasaIntervaloYTermina(t: CronogramaOperativo, d: Date): boolean {
  const intervalo = t.intervalo ?? 1;
  if (intervalo > 1 && t.fecha_inicio) {
    const ancla = parseISO(t.fecha_inicio);
    if (d < ancla) return false;
    const f = t.frecuencia;
    if (f === "DIARIO") {
      const days = Math.round((d.getTime() - ancla.getTime()) / 86_400_000);
      if (days % intervalo !== 0) return false;
    } else if (f === "SEMANAL") {
      const lunesAncla = startOfWeekMon(ancla);
      const lunesD = startOfWeekMon(d);
      const weeks = Math.round((lunesD.getTime() - lunesAncla.getTime()) / (7 * 86_400_000));
      if (weeks % intervalo !== 0) return false;
    } else if (f === "MENSUAL") {
      const months = (d.getFullYear() - ancla.getFullYear()) * 12 + (d.getMonth() - ancla.getMonth());
      if (months % intervalo !== 0) return false;
    } else if (f === "ANUAL") {
      if ((d.getFullYear() - ancla.getFullYear()) % intervalo !== 0) return false;
    }
  }
  if (t.termina_tipo === "fecha" && t.termina_fecha) {
    const fin = parseISO(t.termina_fecha);
    if (d > fin) return false;
  }
  // termina por repeticiones se evalúa en el seeder por ejecuciones reales;
  // en la vista calendario lo dejamos pasar (preview optimista).
  return true;
}

function tareasParaFecha(d: Date, ctx: CtxFecha): CronogramaOperativo[] {
  const iso = isoOfDate(d);
  const dom = d.getDate();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const out: CronogramaOperativo[] = [];

  for (const t of ctx.tareasSemanales) {
    if (!(t.dia_semana ?? []).includes(iso)) continue;
    if (!pasaIntervaloYTermina(t, d)) continue;
    out.push(t);
  }
  for (const t of ctx.tareasMensuales) {
    const target = t.dia_mes ?? 1;
    const effective = Math.min(target, lastDay);
    if (dom !== effective) continue;
    if (!pasaIntervaloYTermina(t, d)) continue;
    out.push(t);
  }
  for (const t of ctx.tareasTrimestrales) {
    const meses = t.meses_trimestrales ?? [1, 4, 7, 10];
    if (!meses.includes(d.getMonth() + 1)) continue;
    const target = t.dia_mes ?? 1;
    const effective = Math.min(target, lastDay);
    if (dom !== effective) continue;
    if (!pasaIntervaloYTermina(t, d)) continue;
    out.push(t);
  }
  for (const t of ctx.tareasAnuales) {
    if (t.fecha_anual !== `${mm}-${dd}`) continue;
    if (!pasaIntervaloYTermina(t, d)) continue;
    out.push(t);
  }
  return out;
}

export function CalendarioCronograma({ grupos, onTareaClick }: Props) {
  const [subVista, setSubVista] = useState<SubVista>("SEMANAL");
  const [diaOffset, setDiaOffset] = useState(0);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [mesOffset, setMesOffset] = useState(0);

  const subsPorParent = useMemo(() => {
    const map = new Map<string, CronogramaOperativo[]>();
    for (const g of grupos) map.set(g.main.id, g.subs);
    return map;
  }, [grupos]);

  const tareasDiarias = useMemo(
    () => grupos.filter((g) => g.main.frecuencia === "DIARIO").map((g) => g.main),
    [grupos],
  );
  const tareasSemanales = useMemo(
    () => grupos.filter((g) => g.main.frecuencia === "SEMANAL").map((g) => g.main),
    [grupos],
  );
  const tareasMensuales = useMemo(
    () => grupos.filter((g) => g.main.frecuencia === "MENSUAL").map((g) => g.main),
    [grupos],
  );
  const tareasTrimestrales = useMemo(
    () => grupos.filter((g) => g.main.frecuencia === "TRIMESTRAL").map((g) => g.main),
    [grupos],
  );
  const tareasAnuales = useMemo(
    () => grupos.filter((g) => g.main.frecuencia === "ANUAL").map((g) => g.main),
    [grupos],
  );

  const today = new Date();
  const diaActual = addDays(today, diaOffset);
  const inicioSemana = addDays(startOfWeekMon(today), semanaOffset * 7);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      {/* Sub-toggle período + navegación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-muted/40 border self-start">
          {(["DIARIO", "SEMANAL", "MENSUAL"] as SubVista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSubVista(v)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all",
                subVista === v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {subVista === "DIARIO" && (
          <NavegadorDia diaOffset={diaOffset} setDiaOffset={setDiaOffset} fecha={diaActual} />
        )}
        {subVista === "SEMANAL" && (
          <NavegadorSemana
            semanaOffset={semanaOffset}
            setSemanaOffset={setSemanaOffset}
            inicioSemana={inicioSemana}
          />
        )}
        {subVista === "MENSUAL" && (
          <NavegadorMes mesOffset={mesOffset} setMesOffset={setMesOffset} />
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {subVista === "DIARIO" && (
          <VistaDiaria
            fecha={diaActual}
            tareasDiarias={tareasDiarias}
            tareasSemanales={tareasSemanales}
            tareasMensuales={tareasMensuales}
            tareasTrimestrales={tareasTrimestrales}
            tareasAnuales={tareasAnuales}
            subsPorParent={subsPorParent}
            onTareaClick={onTareaClick}
          />
        )}
        {subVista === "SEMANAL" && (
          <VistaSemanal
            inicioSemana={inicioSemana}
            tareasDiarias={tareasDiarias}
            tareasSemanales={tareasSemanales}
            tareasMensuales={tareasMensuales}
            tareasTrimestrales={tareasTrimestrales}
            tareasAnuales={tareasAnuales}
            subsPorParent={subsPorParent}
            onTareaClick={onTareaClick}
          />
        )}
        {subVista === "MENSUAL" && (
          <VistaMensual
            grupos={grupos}
            tareasDiarias={tareasDiarias}
            mesOffset={mesOffset}
            onTareaClick={onTareaClick}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────── Navegadores ───────────── */

function NavegadorDia({
  diaOffset, setDiaOffset, fecha,
}: {
  diaOffset: number;
  setDiaOffset: (n: number | ((p: number) => number)) => void;
  fecha: Date;
}) {
  const dia = DIAS[isoOfDate(fecha) - 1];
  const label = `${dia.largo}, ${fecha.getDate()} ${MESES[fecha.getMonth()].toLowerCase()} ${fecha.getFullYear()}`;
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDiaOffset((p: number) => p - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[220px] text-center">{label}</div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDiaOffset((p: number) => p + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {diaOffset !== 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDiaOffset(0)}>
          Hoy
        </Button>
      )}
    </div>
  );
}

function NavegadorSemana({
  semanaOffset, setSemanaOffset, inicioSemana,
}: {
  semanaOffset: number;
  setSemanaOffset: (n: number | ((p: number) => number)) => void;
  inicioSemana: Date;
}) {
  const fin = addDays(inicioSemana, 6);
  const mismoMes = inicioSemana.getMonth() === fin.getMonth();
  const mismoAnio = inicioSemana.getFullYear() === fin.getFullYear();
  const label = mismoMes
    ? `${inicioSemana.getDate()} – ${fin.getDate()} ${MESES[fin.getMonth()].toLowerCase()} ${fin.getFullYear()}`
    : mismoAnio
      ? `${inicioSemana.getDate()} ${MESES_CORTOS[inicioSemana.getMonth()].toLowerCase()} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()].toLowerCase()} ${fin.getFullYear()}`
      : `${inicioSemana.getDate()} ${MESES_CORTOS[inicioSemana.getMonth()].toLowerCase()} ${inicioSemana.getFullYear()} – ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()].toLowerCase()} ${fin.getFullYear()}`;
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSemanaOffset((p: number) => p - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[220px] text-center">{label}</div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSemanaOffset((p: number) => p + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {semanaOffset !== 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSemanaOffset(0)}>
          Hoy
        </Button>
      )}
    </div>
  );
}

function NavegadorMes({ mesOffset, setMesOffset }: { mesOffset: number; setMesOffset: (n: number | ((p: number) => number)) => void }) {
  const fecha = new Date();
  fecha.setDate(1);
  fecha.setMonth(fecha.getMonth() + mesOffset);
  const label = `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMesOffset((p: number) => p - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="text-sm font-medium min-w-[140px] text-center capitalize">{label}</div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMesOffset((p: number) => p + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      {mesOffset !== 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setMesOffset(0)}>
          Hoy
        </Button>
      )}
    </div>
  );
}

/* ───────────── Vista DIARIA ───────────── */

function VistaDiaria({
  fecha, tareasDiarias, tareasSemanales, tareasMensuales, tareasTrimestrales, tareasAnuales, subsPorParent, onTareaClick,
}: {
  fecha: Date;
  tareasDiarias: CronogramaOperativo[];
  tareasSemanales: CronogramaOperativo[];
  tareasMensuales: CronogramaOperativo[];
  tareasTrimestrales: CronogramaOperativo[];
  tareasAnuales: CronogramaOperativo[];
  subsPorParent: Map<string, CronogramaOperativo[]>;
  onTareaClick: (t: CronogramaOperativo) => void;
}) {
  const otras = tareasParaFecha(fecha, { tareasSemanales, tareasMensuales, tareasTrimestrales, tareasAnuales });

  if (tareasDiarias.length === 0 && otras.length === 0) {
    return <EmptyState texto="No hay tareas programadas para este día." />;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {tareasDiarias.length > 0 && (
        <SeccionTareas
          icon={<Sparkles className="h-4 w-4 text-primary" />}
          titulo="Cada día"
          tareas={tareasDiarias}
          subsPorParent={subsPorParent}
          onTareaClick={onTareaClick}
        />
      )}
      {otras.length > 0 && (
        <SeccionTareas
          titulo="Programadas para este día"
          tareas={otras}
          subsPorParent={subsPorParent}
          onTareaClick={onTareaClick}
        />
      )}
    </div>
  );
}

function SeccionTareas({
  icon, titulo, tareas, subsPorParent, onTareaClick,
}: {
  icon?: ReactNode;
  titulo: string;
  tareas: CronogramaOperativo[];
  subsPorParent: Map<string, CronogramaOperativo[]>;
  onTareaClick: (t: CronogramaOperativo) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      </div>
      <ul className="space-y-3">
        {tareas.map((t) => {
          const subs = subsPorParent.get(t.id) ?? [];
          return (
            <li
              key={t.id}
              className="rounded-lg border bg-card hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
            >
              <button
                type="button"
                onClick={() => onTareaClick(t)}
                className="w-full text-left px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{t.tarea}</div>
                  {subs.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l-2 border-muted pl-3">
                      {subs.map((s) => (
                        <li key={s.id} className="text-xs text-muted-foreground">{s.tarea}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {t.tiempo_requerido && (
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    {t.tiempo_requerido}
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────────── Vista SEMANAL ───────────── */

function VistaSemanal({
  inicioSemana, tareasDiarias, tareasSemanales, tareasMensuales, tareasTrimestrales, tareasAnuales, subsPorParent, onTareaClick,
}: {
  inicioSemana: Date;
  tareasDiarias: CronogramaOperativo[];
  tareasSemanales: CronogramaOperativo[];
  tareasMensuales: CronogramaOperativo[];
  tareasTrimestrales: CronogramaOperativo[];
  tareasAnuales: CronogramaOperativo[];
  subsPorParent: Map<string, CronogramaOperativo[]>;
  onTareaClick: (t: CronogramaOperativo) => void;
}) {
  const hoy = new Date();
  const dias7 = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));

  return (
    <div className="flex flex-col">
      {tareasDiarias.length > 0 && (
        <BandaDiaria tareas={tareasDiarias} onTareaClick={onTareaClick} />
      )}

      <div className="grid grid-cols-7 divide-x divide-border/40 min-h-[400px]">
        {dias7.map((d, idx) => {
          const tareas = tareasParaFecha(d, { tareasSemanales, tareasMensuales, tareasTrimestrales, tareasAnuales });
          const isToday = sameDay(d, hoy);
          return (
            <div key={idx} className="flex flex-col">
              <div className={cn(
                "px-2 py-2 text-center border-b",
                isToday ? "bg-primary/5" : "bg-muted/20",
              )}>
                <div className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}>
                  {DIAS[idx].short}
                </div>
                <div className={cn(
                  "text-[11px] font-medium mt-0.5",
                  isToday ? "text-primary" : "text-foreground/80",
                )}>
                  {d.getDate()} {MESES_CORTOS[d.getMonth()].toLowerCase()}
                </div>
                {isToday && (
                  <div className="text-[9px] text-primary/70 mt-0.5">HOY</div>
                )}
              </div>
              <div className="flex-1 p-1.5 space-y-1.5">
                {tareas.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/40 text-center py-2">—</div>
                ) : (
                  tareas.map((t) => (
                    <ChipTarea
                      key={t.id}
                      tarea={t}
                      subs={subsPorParent.get(t.id) ?? []}
                      onClick={() => onTareaClick(t)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BandaDiaria({ tareas, onTareaClick }: { tareas: CronogramaOperativo[]; onTareaClick: (t: CronogramaOperativo) => void }) {
  return (
    <div className="px-4 py-3 bg-primary/[0.04] border-b">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Cada día · {tareas.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tareas.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTareaClick(t)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center gap-1.5"
          >
            <span>{t.tarea}</span>
            {t.tiempo_requerido && (
              <span className="text-[10px] text-muted-foreground font-mono">· {t.tiempo_requerido}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipTarea({ tarea, subs, onClick }: { tarea: CronogramaOperativo; subs: CronogramaOperativo[]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-colors px-2 py-1.5"
    >
      <div className="text-[11px] font-medium leading-tight line-clamp-2">{tarea.tarea}</div>
      {tarea.tiempo_requerido && (
        <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{tarea.tiempo_requerido}</div>
      )}
      {subs.length > 0 && (
        <div className="text-[9px] text-muted-foreground mt-1">+ {subs.length} subtarea{subs.length === 1 ? "" : "s"}</div>
      )}
    </button>
  );
}

/* ───────────── Vista MENSUAL ───────────── */

function VistaMensual({
  grupos, tareasDiarias, mesOffset, onTareaClick,
}: {
  grupos: Grupo[];
  tareasDiarias: CronogramaOperativo[];
  mesOffset: number;
  onTareaClick: (t: CronogramaOperativo) => void;
}) {
  const ahora = new Date();
  const refMes = new Date(ahora.getFullYear(), ahora.getMonth() + mesOffset, 1);
  const year = refMes.getFullYear();
  const month = refMes.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const firstWeekday = isoOfDate(new Date(year, month, 1));
  const padStart = firstWeekday - 1;

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < padStart; i++) {
    const d = new Date(year, month, 1);
    d.setDate(1 - (padStart - i));
    cells.push({ date: d, inMonth: false });
  }
  for (let i = 1; i <= lastDay; i++) {
    cells.push({ date: new Date(year, month, i), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }

  const tareasSemanales = grupos.filter((g) => g.main.frecuencia === "SEMANAL").map((g) => g.main);
  const tareasMensuales = grupos.filter((g) => g.main.frecuencia === "MENSUAL").map((g) => g.main);
  const tareasTrimestrales = grupos.filter((g) => g.main.frecuencia === "TRIMESTRAL").map((g) => g.main);
  const tareasAnuales = grupos.filter((g) => g.main.frecuencia === "ANUAL").map((g) => g.main);

  const tareasDelDia = (d: Date): CronogramaOperativo[] => {
    if (!d) return [];
    const iso = isoOfDate(d);
    const dom = d.getDate();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const out: CronogramaOperativo[] = [];

    for (const t of tareasSemanales) {
      if (!(t.dia_semana ?? []).includes(iso)) continue;
      if (!pasaIntervaloYTermina(t, d)) continue;
      out.push(t);
    }
    for (const t of tareasMensuales) {
      const target = t.dia_mes ?? 1;
      const effective = Math.min(target, lastDay);
      if (dom !== effective || d.getMonth() !== month) continue;
      if (!pasaIntervaloYTermina(t, d)) continue;
      out.push(t);
    }
    for (const t of tareasTrimestrales) {
      const meses = t.meses_trimestrales ?? [1, 4, 7, 10];
      if (!meses.includes(d.getMonth() + 1)) continue;
      const target = t.dia_mes ?? 1;
      const lastOfThis = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const effective = Math.min(target, lastOfThis);
      if (dom !== effective) continue;
      if (!pasaIntervaloYTermina(t, d)) continue;
      out.push(t);
    }
    for (const t of tareasAnuales) {
      if (t.fecha_anual !== `${mm}-${dd}`) continue;
      if (!pasaIntervaloYTermina(t, d)) continue;
      out.push(t);
    }
    return out;
  };

  const hoy = new Date();

  return (
    <div className="flex flex-col">
      {/* Banda DIARIO */}
      {tareasDiarias.length > 0 && (
        <BandaDiaria tareas={tareasDiarias} onTareaClick={onTareaClick} />
      )}

      {/* Cabecera de días */}
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {DIAS.map((d) => (
          <div key={d.iso} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d.short}
          </div>
        ))}
      </div>

      {/* Grilla mensual */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {cells.map((c, i) => {
          const tareas = c.inMonth ? tareasDelDia(c.date) : [];
          const isToday = sameDay(c.date, hoy);
          return (
            <div
              key={i}
              className={cn(
                "min-h-[88px] p-1.5 border-r border-b border-border/40 flex flex-col gap-1",
                !c.inMonth && "bg-muted/10",
                isToday && "bg-primary/[0.04]",
              )}
            >
              <div className={cn(
                "text-[11px] font-semibold",
                !c.inMonth && "text-muted-foreground/40",
                isToday && "text-primary",
              )}>
                {isToday ? (
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px]">
                    {c.date.getDate()}
                  </span>
                ) : (
                  c.date.getDate()
                )}
              </div>
              {tareas.length > 0 && (
                <div className="space-y-0.5 overflow-hidden">
                  {tareas.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onTareaClick(t)}
                      className={cn(
                        "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate transition-colors",
                        t.frecuencia === "MENSUAL" && "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300",
                        t.frecuencia === "SEMANAL" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300",
                        t.frecuencia === "TRIMESTRAL" && "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300",
                        t.frecuencia === "ANUAL" && "bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-300",
                      )}
                    >
                      {t.tarea}
                    </button>
                  ))}
                  {tareas.length > 3 && (
                    <div className="text-[9px] text-muted-foreground px-1.5">+ {tareas.length - 3} más</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="px-4 py-3 border-t bg-muted/10 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <LeyendaPunto color="bg-emerald-400" texto="Semanal" />
        <LeyendaPunto color="bg-blue-400" texto="Mensual" />
        <LeyendaPunto color="bg-violet-400" texto="Trimestral" />
        <LeyendaPunto color="bg-orange-400" texto="Anual" />
      </div>
    </div>
  );
}

function LeyendaPunto({ color, texto }: { color: string; texto: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span>{texto}</span>
    </div>
  );
}

/* ───────────── Empty ───────────── */

function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">{texto}</div>
  );
}
