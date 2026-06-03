"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users, Utensils, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReservasMes, gridFechasMes } from "@/features/sala/hooks/useReservasMes";
import type { HorarioResuelto } from "@/features/sala/lib/horario-resolver";

interface Props {
  /** Fecha activa (YYYY-MM-DD). Determina el mes mostrado al montar y resincroniza al cambiar de mes. */
  fecha: string;
  /** Fecha resaltada como seleccionada (típicamente igual a `fecha`). */
  fechaSeleccionada?: string;
  /** Aforo total por turno (suma de capacidad de mesas activas). */
  aforoPorTurno: number;
  /** Click en una celda de día. */
  onDayClick: (fecha: string) => void;
  /** Vista compacta para usar como date-picker lateral (sin KPIs por celda). */
  compacto?: boolean;
  /** Ocultar la cabecera interna (mes + KPIs) cuando ya se controla desde fuera. */
  hideHeader?: boolean;
  /** Notifica al padre los totales agregados del mes mostrado (personas + reservas). */
  onTotalesChange?: (t: { personas: number; reservas: number }) => void;
}

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_HEADER_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_HEADER_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

export function CalendarioMes({
  fecha,
  fechaSeleccionada,
  aforoPorTurno,
  onDayClick,
  compacto = false,
  hideHeader = false,
  onTotalesChange,
}: Props) {
  const base = new Date(fecha + "T12:00:00");
  const [anio, setAnio] = useState(base.getFullYear());
  const [mes0, setMes0] = useState(base.getMonth());
  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const seleccionISO = fechaSeleccionada ?? fecha;

  // Resincroniza el mes mostrado cuando la fecha activa cambia desde fuera (flechas del top bar).
  useEffect(() => {
    const d = new Date(fecha + "T12:00:00");
    setAnio(d.getFullYear());
    setMes0(d.getMonth());
  }, [fecha]);

  const { loading, metricasFecha, horarioFecha, totales } = useReservasMes(anio, mes0, aforoPorTurno);
  const grid = gridFechasMes(anio, mes0);

  useEffect(() => {
    onTotalesChange?.({ personas: totales.personas, reservas: totales.reservas });
  }, [totales.personas, totales.reservas, onTotalesChange]);

  function navegar(delta: number) {
    let nuevoMes = mes0 + delta;
    let nuevoAnio = anio;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAnio -= 1;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAnio += 1;
    }
    setAnio(nuevoAnio);
    setMes0(nuevoMes);
  }

  function irHoy() {
    setAnio(hoy.getFullYear());
    setMes0(hoy.getMonth());
    onDayClick(hoyISO);
  }

  const DIAS_HEADER = compacto ? DIAS_HEADER_CORTOS : DIAS_HEADER_LARGOS;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header del mes */}
      {!hideHeader && (
      <div className={cn(
        "border-b flex items-center gap-2 bg-card",
        compacto ? "px-2 py-2" : "px-4 py-3 gap-3",
      )}>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navegar(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "text-xs h-7 justify-center font-medium uppercase",
              compacto ? "min-w-[110px] px-2" : "min-w-[160px]",
            )}
            onClick={irHoy}
            title="Ir a hoy"
          >
            {MESES_ES[mes0]} {anio}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navegar(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!compacto && (
          <div className="ml-auto flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold">{totales.personas}</span>
              <span className="text-muted-foreground">personas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Utensils className="h-4 w-4 text-sky-500" />
              <span className="font-semibold">{totales.reservas}</span>
              <span className="text-muted-foreground">reservas</span>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Cabecera de días */}
      <div className={cn(
        "grid grid-cols-7 border-b font-medium text-muted-foreground bg-muted/30",
        compacto ? "text-[10px]" : "text-[11px]",
      )}>
        {DIAS_HEADER.map((d) => (
          <div key={d} className={cn("text-center", compacto ? "px-1 py-1" : "px-2 py-1.5")}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className={cn(
        "grid grid-cols-7 overflow-auto",
        compacto ? "flex-1 auto-rows-fr" : "flex-1 grid-rows-6",
      )}>
        {grid.map((iso) => {
          const d = new Date(iso + "T12:00:00");
          const esOtroMes = d.getMonth() !== mes0;
          const esHoy = iso === hoyISO;
          const esSeleccionado = iso === seleccionISO;
          const m = metricasFecha(iso);
          const totalReservasDia = m.comida.reservas + m.cena.reservas;
          const totalPersonasDia = m.comida.personas + m.cena.personas;
          const h = compacto ? null : horarioFecha(iso);
          const comidaActiva = !!h && !h.comida.cerrado && h.comida.fuente !== "sin_definir" && !!h.comida.inicio && !!h.comida.fin;
          const cenaActiva   = !!h && !h.cena.cerrado   && h.cena.fuente   !== "sin_definir" && !!h.cena.inicio   && !!h.cena.fin;
          const comidaCerrada = !!h && h.comida.cerrado;
          const cenaCerrada   = !!h && h.cena.cerrado;
          const ambasCerradas = !!h && comidaCerrada && cenaCerrada;
          return (
            <button
              key={iso}
              onClick={() => onDayClick(iso)}
              className={cn(
                "border-r border-b text-left flex flex-col hover:bg-accent/40 transition-colors",
                compacto ? "p-1 items-center justify-center gap-0.5 min-h-[44px]" : "p-1.5 gap-1",
                esOtroMes && "bg-muted/20 text-muted-foreground",
                esHoy && !esSeleccionado && "bg-amber-100 dark:bg-amber-900/30",
                esSeleccionado && "bg-primary text-primary-foreground hover:bg-primary/90 ring-1 ring-primary",
              )}
            >
              {compacto ? (
                <>
                  <span className="text-xs font-semibold">{d.getDate().toString().padStart(2, "0")}</span>
                  {!loading && totalReservasDia > 0 && (
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        esSeleccionado ? "bg-primary-foreground/80" : "bg-sky-500",
                      )}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] w-full">
                    <span
                      className={cn(
                        "font-semibold",
                        esHoy && !esSeleccionado && "text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {d.getDate().toString().padStart(2, "0")}
                    </span>
                  </div>

                  {!loading && (
                    <div className="flex-1 flex flex-col justify-center gap-0.5">
                      {ambasCerradas ? (
                        <div className={cn(
                          "text-center text-[11px] font-medium uppercase tracking-wide",
                          esSeleccionado ? "text-primary-foreground/90" : "text-red-600 dark:text-red-300",
                        )}>
                          Cerrado
                        </div>
                      ) : (
                        <>
                          {(comidaActiva || comidaCerrada) && (
                            <HorarioLinea turno="comida" h={h!.comida} selected={esSeleccionado} />
                          )}
                          {(cenaActiva || cenaCerrada) && (
                            <HorarioLinea turno="cena" h={h!.cena} selected={esSeleccionado} />
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {!loading && (totalReservasDia > 0 || totalPersonasDia > 0) && (
                    <div className={cn(
                      "flex items-center justify-end gap-2 text-[10px] tabular-nums",
                      esSeleccionado ? "text-primary-foreground/90" : "text-muted-foreground",
                    )}>
                      <span className="inline-flex items-center gap-0.5">
                        <Utensils className={cn("h-2.5 w-2.5", esSeleccionado ? "" : "text-sky-500")} />
                        <span className="font-semibold">{totalReservasDia}</span>
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Users className={cn("h-2.5 w-2.5", esSeleccionado ? "" : "text-emerald-500")} />
                        <span className="font-semibold">{totalPersonasDia}</span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HorarioLinea({
  turno,
  h,
  selected,
}: {
  turno: "comida" | "cena";
  h: HorarioResuelto;
  selected: boolean;
}) {
  const Icon = turno === "comida" ? Sun : Moon;
  const tono = turno === "comida" ? "text-amber-500" : "text-indigo-400";
  const cerrado = h.cerrado;
  const ini = (h.inicio ?? "").slice(0, 5);
  const fin = (h.fin ?? "").slice(0, 5);
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] leading-tight tabular-nums",
        cerrado && !selected && "text-red-600 dark:text-red-300",
      )}
      title={turno === "comida" ? "Comida" : "Cena"}
    >
      <Icon className={cn("h-3 w-3 shrink-0", !selected && (cerrado ? "text-red-500" : tono))} />
      {cerrado ? (
        <span className="font-medium">Cerrado</span>
      ) : (
        <span className="font-medium">{ini}–{fin}</span>
      )}
    </div>
  );
}
