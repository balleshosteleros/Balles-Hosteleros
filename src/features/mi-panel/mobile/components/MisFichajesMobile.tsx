"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox, AlertTriangle, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { listarMisFichajes } from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { formatHorasDecimal } from "@/shared/lib/timeUtils";
import { cn } from "@/shared/lib/utils";

const ESTADO_LABEL: Record<string, string> = {
  trabajando: "En curso",
  pausa: "En pausa",
  completado: "Correcto",
  pendiente: "Pendiente",
  "sin cerrar": "Sin cerrar",
  incidencia: "Incidencia",
};

const ESTADO_COLOR: Record<string, string> = {
  trabajando: "bg-emerald-500",
  pausa: "bg-amber-500",
  completado: "bg-emerald-500",
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

/** Agrupa los fichajes de un mes por fecha (un día puede tener varios tramos: 2 entradas / 2 salidas). */
function groupByDay(items: MiFichajeHoy[]): Array<{ fecha: string; tramos: MiFichajeHoy[] }> {
  const groups = new Map<string, MiFichajeHoy[]>();
  for (const item of items) {
    const arr = groups.get(item.fecha) ?? [];
    arr.push(item);
    groups.set(item.fecha, arr);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fecha, tramos]) => ({
      fecha,
      // Tramos del día en orden cronológico (entrada más temprana primero).
      tramos: tramos.sort((a, b) =>
        (a.horaEntrada ?? "").localeCompare(b.horaEntrada ?? ""),
      ),
    }));
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
              {groupByDay(group.items).map((dia) => {
                const totalDia = dia.tramos.reduce((acc, t) => acc + (t.horasTotales ?? 0), 0);
                const hayAlerta = dia.tramos.some((t) =>
                  ESTADOS_ALERTA.has(deriveEstadoMostrado(t, hoy)),
                );
                const tramoRef = dia.tramos[0];
                return (
                  <li
                    key={dia.fecha}
                    className={cn(
                      "rounded-2xl border bg-card p-3.5",
                      hayAlerta ? "border-rose-200 bg-rose-50/40 dark:bg-rose-950/20" : "border-border/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">
                          {formatFechaLarga(dia.fecha)}
                        </p>
                        <span
                          className={cn(
                            "mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            tramoRef.modoTeletrabajo
                              ? "border-blue-200 bg-blue-100 text-blue-700"
                              : "border-emerald-200 bg-emerald-100 text-emerald-700",
                          )}
                        >
                          {tramoRef.modoTeletrabajo ? "Teletrabajo" : (tramoRef.local || "Local")}
                        </span>
                      </div>
                      <p className="text-base font-semibold tabular-nums">
                        {formatHorasDecimal(totalDia)}
                      </p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {dia.tramos.map((t, i) => {
                        const estado = deriveEstadoMostrado(t, hoy);
                        const esCorrecto = estado === "completado";
                        return (
                          <div
                            key={t.id}
                            className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2"
                          >
                            {dia.tramos.length > 1 && (
                              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Tramo {i + 1}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Entrada
                                  </p>
                                  <p className="text-sm font-semibold tabular-nums">
                                    {formatHora(t.horaEntrada)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <LogOut className="h-3.5 w-3.5 text-rose-500" />
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Salida
                                  </p>
                                  <p className="text-sm font-semibold tabular-nums">
                                    {formatHora(t.horaSalida)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              {esCorrecto ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    ESTADO_COLOR[estado] ?? "bg-slate-400",
                                  )}
                                />
                              )}
                              <span
                                className={cn(
                                  "text-[10px] uppercase tracking-wider",
                                  esCorrecto ? "font-medium text-emerald-600" : "text-muted-foreground",
                                )}
                              >
                                {ESTADO_LABEL[estado] ?? estado}
                              </span>
                            </div>
                            {t.incidencia && (
                              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-100/60 p-2 text-xs text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{t.incidencia}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
