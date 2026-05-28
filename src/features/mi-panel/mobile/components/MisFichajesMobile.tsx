"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox, AlertTriangle, Clock } from "lucide-react";
import { listarMisFichajes } from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { formatHorasDecimal } from "@/shared/lib/timeUtils";
import { cn } from "@/shared/lib/utils";

const ESTADO_LABEL: Record<string, string> = {
  trabajando: "En curso",
  pausa: "En pausa",
  completado: "Completado",
  pendiente: "Pendiente",
  "sin cerrar": "Sin cerrar",
  incidencia: "Incidencia",
};

const ESTADO_COLOR: Record<string, string> = {
  trabajando: "bg-emerald-500",
  pausa: "bg-amber-500",
  completado: "bg-slate-400",
  pendiente: "bg-blue-500",
  "sin cerrar": "bg-orange-500",
  incidencia: "bg-rose-500",
};

const ESTADOS_ALERTA = new Set(["sin cerrar", "incidencia"]);

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function deriveEstadoMostrado(f: MiFichajeHoy, hoy: string): string {
  if (!f.horaSalida && f.estado === "trabajando" && f.fecha !== hoy) {
    return "sin cerrar";
  }
  return f.estado;
}

function formatFechaLarga(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatHora(s: string | null): string {
  if (!s) return "—";
  if (s.includes("T")) {
    return new Date(s).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return s.slice(0, 5);
}

function groupByMonth(items: MiFichajeHoy[]): Array<{ key: string; label: string; items: MiFichajeHoy[] }> {
  const groups = new Map<string, MiFichajeHoy[]>();
  for (const item of items) {
    const [y, m] = item.fecha.split("-");
    const key = `${y}-${m}`;
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [y, m] = key.split("-").map(Number);
      const date = new Date(y, m - 1, 1);
      return {
        key,
        label: date.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
        items,
      };
    });
}

export function MisFichajesMobile() {
  const [items, setItems] = useState<MiFichajeHoy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    listarMisFichajes(60).then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const hoy = todayISO();
  const groups = groupByMonth(items);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Inbox className="mb-2 h-8 w-8" />
        <p className="text-sm">Aún no tienes fichajes registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {groups.map((group) => {
        const totalHoras = group.items.reduce((acc, f) => acc + (f.horasTotales ?? 0), 0);
        return (
          <section key={group.key}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatHorasDecimal(totalHoras)}
              </span>
            </div>
            <ul className="space-y-2">
              {group.items.map((f) => {
                const estado = deriveEstadoMostrado(f, hoy);
                const isAlerta = ESTADOS_ALERTA.has(estado);
                return (
                  <li
                    key={f.id}
                    className={cn(
                      "rounded-2xl border bg-card p-3.5",
                      isAlerta ? "border-rose-200 bg-rose-50/40 dark:bg-rose-950/20" : "border-border/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">
                          {formatFechaLarga(f.fecha)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatHora(f.horaEntrada)} – {formatHora(f.horaSalida)}
                          </span>
                          {(f.pausaInicio || f.pausaFin) && (
                            <span>· descanso {formatHora(f.pausaInicio)}–{formatHora(f.pausaFin)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold tabular-nums">
                          {formatHorasDecimal(f.horasTotales ?? 0)}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              ESTADO_COLOR[estado] ?? "bg-slate-400",
                            )}
                          />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {ESTADO_LABEL[estado] ?? estado}
                          </span>
                        </div>
                      </div>
                    </div>
                    {f.incidencia && (
                      <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-rose-100/60 p-2 text-xs text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{f.incidencia}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
