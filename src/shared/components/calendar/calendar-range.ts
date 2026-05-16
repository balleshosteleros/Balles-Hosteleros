import { useCallback, useMemo, useState } from "react";

export type CalendarRangeMode =
  | "DIARIO"
  | "SEMANAL"
  | "MENSUAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL";

export const CALENDAR_RANGE_MODES: CalendarRangeMode[] = [
  "DIARIO",
  "SEMANAL",
  "MENSUAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function isoOfDate(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeekMon(d: Date): Date {
  const out = startOfDay(d);
  const iso = isoOfDate(out);
  out.setDate(out.getDate() - (iso - 1));
  return out;
}

function endOfWeekSun(d: Date): Date {
  const start = startOfWeekMon(d);
  start.setDate(start.getDate() + 6);
  return endOfDay(start);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return endOfDay(new Date(d.getFullYear(), q * 3 + 3, 0));
}

function startOfSemester(d: Date): Date {
  const s = d.getMonth() < 6 ? 0 : 6;
  return new Date(d.getFullYear(), s, 1);
}

function endOfSemester(d: Date): Date {
  const s = d.getMonth() < 6 ? 0 : 6;
  return endOfDay(new Date(d.getFullYear(), s + 6, 0));
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function endOfYear(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), 11, 31));
}

export function rangeFor(mode: CalendarRangeMode, anchor: Date): { start: Date; end: Date } {
  switch (mode) {
    case "DIARIO":
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case "SEMANAL":
      return { start: startOfWeekMon(anchor), end: endOfWeekSun(anchor) };
    case "MENSUAL":
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case "TRIMESTRAL":
      return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) };
    case "SEMESTRAL":
      return { start: startOfSemester(anchor), end: endOfSemester(anchor) };
    case "ANUAL":
      return { start: startOfYear(anchor), end: endOfYear(anchor) };
  }
}

export function shiftAnchor(mode: CalendarRangeMode, anchor: Date, delta: number): Date {
  const out = new Date(anchor);
  switch (mode) {
    case "DIARIO":
      out.setDate(out.getDate() + delta);
      return out;
    case "SEMANAL":
      out.setDate(out.getDate() + delta * 7);
      return out;
    case "MENSUAL":
      out.setMonth(out.getMonth() + delta);
      return out;
    case "TRIMESTRAL":
      out.setMonth(out.getMonth() + delta * 3);
      return out;
    case "SEMESTRAL":
      out.setMonth(out.getMonth() + delta * 6);
      return out;
    case "ANUAL":
      out.setFullYear(out.getFullYear() + delta);
      return out;
  }
}

const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function labelFor(mode: CalendarRangeMode, anchor: Date): string {
  const r = rangeFor(mode, anchor);
  switch (mode) {
    case "DIARIO": {
      const d = r.start;
      const dia = DIAS_LARGOS[isoOfDate(d) - 1];
      return `${dia}, ${d.getDate()} ${MESES[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
    }
    case "SEMANAL": {
      const a = r.start;
      const b = r.end;
      const mismoMes = a.getMonth() === b.getMonth();
      const mismoAnio = a.getFullYear() === b.getFullYear();
      if (mismoMes) {
        return `${a.getDate()} – ${b.getDate()} ${MESES[b.getMonth()].toLowerCase()} ${b.getFullYear()}`;
      }
      if (mismoAnio) {
        return `${a.getDate()} ${MESES_CORTOS[a.getMonth()].toLowerCase()} – ${b.getDate()} ${MESES_CORTOS[b.getMonth()].toLowerCase()} ${b.getFullYear()}`;
      }
      return `${a.getDate()} ${MESES_CORTOS[a.getMonth()].toLowerCase()} ${a.getFullYear()} – ${b.getDate()} ${MESES_CORTOS[b.getMonth()].toLowerCase()} ${b.getFullYear()}`;
    }
    case "MENSUAL":
      return `${MESES[r.start.getMonth()]} ${r.start.getFullYear()}`;
    case "TRIMESTRAL": {
      const q = Math.floor(r.start.getMonth() / 3) + 1;
      return `T${q} ${r.start.getFullYear()} · ${MESES_CORTOS[r.start.getMonth()]}–${MESES_CORTOS[r.end.getMonth()]}`;
    }
    case "SEMESTRAL": {
      const s = r.start.getMonth() < 6 ? 1 : 2;
      return `S${s} ${r.start.getFullYear()} · ${MESES_CORTOS[r.start.getMonth()]}–${MESES_CORTOS[r.end.getMonth()]}`;
    }
    case "ANUAL":
      return `${r.start.getFullYear()}`;
  }
}

export interface CalendarRangeState {
  mode: CalendarRangeMode;
  setMode: (m: CalendarRangeMode) => void;
  anchor: Date;
  setAnchor: (d: Date) => void;
  range: { start: Date; end: Date };
  label: string;
  prev: () => void;
  next: () => void;
  goToToday: () => void;
  isToday: boolean;
}

export function useCalendarRange(initialMode: CalendarRangeMode = "MENSUAL"): CalendarRangeState {
  const [mode, setMode] = useState<CalendarRangeMode>(initialMode);
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const range = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const label = useMemo(() => labelFor(mode, anchor), [mode, anchor]);

  const prev = useCallback(() => setAnchor((a) => shiftAnchor(mode, a, -1)), [mode]);
  const next = useCallback(() => setAnchor((a) => shiftAnchor(mode, a, +1)), [mode]);
  const goToToday = useCallback(() => setAnchor(new Date()), []);

  const isToday = useMemo(() => {
    const now = new Date();
    return now >= range.start && now <= range.end;
  }, [range]);

  return { mode, setMode, anchor, setAnchor, range, label, prev, next, goToToday, isToday };
}
