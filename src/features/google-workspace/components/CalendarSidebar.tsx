"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Barra lateral de calendarios compartida por los paneles de Calendar y Meet:
// mini-calendario navegable + lista "Mis calendarios" con casillas de color
// para filtrar. Misma UI en ambos sitios.

export type SidebarCalendar = {
  id: string;
  nombre: string;
  color: string;
  primary?: boolean;
};

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

function fmtMesAnio(d: Date): string {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export function CalendarSidebar({
  calendarios,
  seleccionados,
  onToggle,
  fechaRef,
  onSelectDate,
  nowIso,
  connected,
}: {
  calendarios: SidebarCalendar[];
  seleccionados: Set<string>;
  onToggle: (id: string) => void;
  fechaRef: Date;
  onSelectDate: (d: Date) => void;
  nowIso: string;
  connected: boolean;
}) {
  return (
    <aside className="w-48 lg:w-56 xl:w-64 shrink-0 overflow-y-auto border-r bg-muted/20 p-2">
      <MiniCalendario
        fechaRef={fechaRef}
        onSelect={onSelectDate}
        nowIso={nowIso}
      />
      <p className="mb-1 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Mis calendarios
      </p>
      {calendarios.length === 0 &&
        (connected ? (
          <div className="flex items-center justify-center px-2 py-2">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <p className="px-2 text-[11px] italic text-muted-foreground">
            Conecta Google para ver tus calendarios
          </p>
        ))}
      <ul className="space-y-0.5">
        {calendarios.map((cal) => {
          const activo = seleccionados.has(cal.id);
          return (
            <li key={cal.id}>
              <button
                type="button"
                onClick={() => onToggle(cal.id)}
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
                  {activo && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </span>
                <span
                  className={cn(
                    "truncate",
                    activo
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {cal.nombre}
                </span>
                {cal.primary && (
                  <Badge
                    variant="outline"
                    className="ml-auto h-4 px-1 text-[8px]"
                  >
                    Mío
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ─── Mini-calendario ─────────────────────────────────────────
function MiniCalendario({
  fechaRef,
  onSelect,
  nowIso,
}: {
  fechaRef: Date;
  onSelect: (d: Date) => void;
  nowIso: string;
}) {
  const [mes, setMes] = useState(
    () => new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 1),
  );
  useEffect(() => {
    setMes(new Date(fechaRef.getFullYear(), fechaRef.getMonth(), 1));
  }, [fechaRef]);
  const inicio = getInicioSemana(mes);
  const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
  const fin = getInicioSemana(ultimo);
  fin.setDate(fin.getDate() + 7);
  const dias: Date[] = [];
  const cur = new Date(inicio);
  while (cur < fin) {
    dias.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const refIso = isoDate(fechaRef);
  return (
    <div className="px-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold capitalize text-foreground">
          {fmtMesAnio(mes)}
        </span>
        <div className="flex">
          <button
            type="button"
            onClick={() =>
              setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))
            }
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))
            }
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d} className="text-[9px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {dias.map((d) => {
          const dIso = isoDate(d);
          const esHoy = dIso === nowIso;
          const esRef = dIso === refIso;
          const esMes = d.getMonth() === mes.getMonth();
          return (
            <button
              key={dIso}
              type="button"
              onClick={() => onSelect(d)}
              className={cn(
                "mx-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors",
                !esMes && "text-muted-foreground/40",
                esMes && !esHoy && !esRef && "text-foreground hover:bg-muted",
                esRef && !esHoy && "bg-blue-100 text-blue-700 font-semibold",
                esHoy && "bg-blue-600 text-white font-semibold",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
