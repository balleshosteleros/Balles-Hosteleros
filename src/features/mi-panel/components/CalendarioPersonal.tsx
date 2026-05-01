"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getMiCalendarioMes } from "@/features/mi-panel/actions/mi-panel-actions";
import type { DiaCalendario } from "@/features/mi-panel/types";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function indexLunes(date: Date): number {
  // 0 = lunes ... 6 = domingo
  return (date.getDay() + 6) % 7;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface CalendarioPersonalProps {
  refreshKey?: number;
}

export function CalendarioPersonal({ refreshKey = 0 }: CalendarioPersonalProps) {
  const today = new Date();
  const [anio, setAnio] = useState(today.getFullYear());
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [dias, setDias] = useState<DiaCalendario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getMiCalendarioMes(anio, mes).then((res) => {
      if (cancel) return;
      setDias(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [anio, mes, refreshKey]);

  const map = useMemo(() => {
    const m = new Map<string, DiaCalendario>();
    for (const d of dias) m.set(d.fecha, d);
    return m;
  }, [dias]);

  const primerDia = new Date(anio, mes - 1, 1);
  const totalDias = new Date(anio, mes, 0).getDate();
  const offsetIni = indexLunes(primerDia);
  const celdas: { fecha: string | null; dia: number | null }[] = [];
  for (let i = 0; i < offsetIni; i++) celdas.push({ fecha: null, dia: null });
  for (let d = 1; d <= totalDias; d++) {
    const fecha = ymd(new Date(anio, mes - 1, d));
    celdas.push({ fecha, dia: d });
  }
  while (celdas.length % 7 !== 0) celdas.push({ fecha: null, dia: null });

  function prev() {
    if (mes === 1) {
      setMes(12);
      setAnio(anio - 1);
    } else {
      setMes(mes - 1);
    }
  }
  function next() {
    if (mes === 12) {
      setMes(1);
      setAnio(anio + 1);
    } else {
      setMes(mes + 1);
    }
  }

  const todayKey = ymd(today);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Mi calendario</h2>
          <p className="text-xs text-muted-foreground">Días trabajados, ausencias y horario</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prev} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">
            {MESES[mes - 1]} {anio}
          </span>
          <Button variant="ghost" size="icon" onClick={next} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Cargando…
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c, i) => {
            if (!c.fecha) return <div key={i} className="aspect-square" />;
            const info = map.get(c.fecha);
            const isToday = c.fecha === todayKey;

            let bg = "bg-muted/30";
            let label: string | null = null;
            if (info?.ausencia === "vacaciones") {
              bg = "bg-blue-100 hover:bg-blue-200";
              label = "Vacaciones";
            } else if (info?.ausencia === "baja_medica") {
              bg = "bg-rose-100 hover:bg-rose-200";
              label = "Baja médica";
            } else if (info?.ausencia === "permiso") {
              bg = "bg-violet-100 hover:bg-violet-200";
              label = "Permiso";
            } else if (info?.fichado) {
              bg = "bg-emerald-100 hover:bg-emerald-200";
              label = `Trabajado · ${info.horasFichaje?.toFixed(1) ?? "0"}h`;
            }

            return (
              <div
                key={i}
                title={label ?? c.fecha}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs transition-colors cursor-default ${bg} ${
                  isToday ? "ring-2 ring-primary" : ""
                }`}
              >
                <span className={`font-semibold ${isToday ? "text-primary" : ""}`}>{c.dia}</span>
                {info?.fichado && !info.ausencia && (
                  <span className="text-[9px] text-emerald-700 leading-none">
                    {info.horasFichaje?.toFixed(1) ?? "0"}h
                  </span>
                )}
                {info?.trabajoExtra === "horas_extras" && (
                  <span className="text-[9px] text-amber-700 leading-none">+ extras</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" /> Trabajado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-200" /> Vacaciones
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-200" /> Baja médica
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-200" /> Permiso
        </span>
      </div>
    </Card>
  );
}
