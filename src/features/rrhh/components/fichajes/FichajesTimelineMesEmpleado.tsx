"use client";

/**
 * Timeline MENSUAL de un empleado (pestaña Fichajes de su ficha). Cabecera con el
 * total del mes (fichado / teóricas), selector de mes, y una fila por día del mes
 * con su barra previsto vs fichado. Al desplegar un día se ve el detalle de cada
 * fichaje (horario + tipo). Fuente: loadTimelineMesEmpleado.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  loadTimelineMesEmpleado,
  type TimelineDiaMes,
} from "@/features/rrhh/actions/horas-actions";
import {
  ReglaHoras,
  TimelineBarra,
  LeyendaTimeline,
  fmtHM,
} from "@/features/rrhh/components/fichajes/timeline-shared";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_SEM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function labelMes(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  return `${MESES[m - 1] ?? ""} ${y}`.replace(/^\w/, (c) => c.toUpperCase());
}
function labelDiaMes(fechaISO: string): string {
  const d = new Date(`${fechaISO}T12:00:00`);
  return `${DIAS_SEM[d.getDay()]} ${d.getDate()}`;
}
function moverMes(periodo: string, delta: number): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function FichajesTimelineMesEmpleado({ empleadoId }: { empleadoId: string }) {
  const { empresaActual } = useEmpresa();
  const [periodo, setPeriodo] = useState<string>(() => periodoActual());
  const [dias, setDias] = useState<TimelineDiaMes[]>([]);
  const [totFichadas, setTotFichadas] = useState(0);
  const [totTeoricas, setTotTeoricas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void loadTimelineMesEmpleado(empleadoId, periodo).then((r) => {
      if (!vivo) return;
      setDias(r.data.dias);
      setTotFichadas(r.data.horasFichadasMes);
      setTotTeoricas(r.data.horasTeoricasMes);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [empleadoId, periodo, empresaActual.id]);

  const hoyISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const toggle = (fechaISO: string) =>
    setAbierto((prev) => {
      const next = new Set(prev);
      if (next.has(fechaISO)) next.delete(fechaISO);
      else next.add(fechaISO);
      return next;
    });

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        {/* Cabecera: total del mes + selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Este mes</p>
            <p className="text-lg font-semibold tabular-nums">
              {fmtHM(totFichadas)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {fmtHM(totTeoricas)} teóricas
              </span>
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border p-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPeriodo((p) => moverMes(p, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">{labelMes(periodo)}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPeriodo((p) => moverMes(p, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Rejilla timeline mensual */}
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[900px]">
            {/* Cabecera: Fecha | Horas | regla 0-24 */}
            <div className="flex items-center border-b bg-muted/40 text-[11px] text-muted-foreground">
              <div className="w-32 shrink-0 px-4 py-2 font-medium">Fecha</div>
              <div className="w-28 shrink-0 px-2 py-2 font-medium">Horas</div>
              <ReglaHoras />
            </div>

            {cargando ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
            ) : (
              dias.map((d) => {
                const tieneAlgo = d.previsto.length > 0 || d.fichado.length > 0;
                const estaAbierto = abierto.has(d.fechaISO);
                return (
                  <div key={d.fechaISO} className={`border-b last:border-b-0 ${d.fechaISO === hoyISO ? "bg-primary/5" : ""}`}>
                    {/* Fila del día */}
                    <div className="flex items-center hover:bg-muted/20">
                      <button
                        type="button"
                        onClick={() => d.fichado.length > 0 && toggle(d.fechaISO)}
                        className="flex w-32 shrink-0 items-center gap-1 px-4 py-3 text-left"
                      >
                        {d.fichado.length > 0 ? (
                          estaAbierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <span className="w-3.5" />
                        )}
                        <span className="text-sm">{labelDiaMes(d.fechaISO)}</span>
                      </button>
                      <div className="w-28 shrink-0 px-2 py-3 text-xs">
                        <span className="font-semibold tabular-nums">{fmtHM(d.horasFichadas)}</span>
                        <span className="text-muted-foreground tabular-nums"> / {fmtHM(d.horasPrevistas)}</span>
                      </div>
                      <div className="relative flex-1 px-0 py-3">
                        {tieneAlgo ? (
                          <TimelineBarra previsto={d.previsto} fichado={d.fichado} superponer />
                        ) : (
                          <div className="h-4" />
                        )}
                      </div>
                    </div>

                    {/* Detalle desplegado: cada fichaje del día */}
                    {estaAbierto && d.fichado.length > 0 && (
                      <div className="border-t bg-muted/10 px-4 py-2">
                        {d.fichado.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 py-1 text-sm">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                f.extra ? "bg-rose-500" : f.origen === "solicitud" ? "bg-sky-500" : "bg-emerald-500"
                              }`}
                            />
                            <span className="tabular-nums">
                              {f.horaInicio} – {f.horaFin ?? "en curso"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {f.extra ? "Horas extras" : f.origen === "solicitud" ? "Normal (por solicitud)" : "Fichaje normal"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <LeyendaTimeline />
      </div>
    </TooltipProvider>
  );
}
