"use client";

import { useMemo, useState } from "react";
import { Lock, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useCronogramasOperativos,
  type CronogramaOperativo,
  type Frecuencia,
} from "@/features/direccion/hooks/useCronogramasOperativos";

const FRECUENCIA_COLOR: Record<string, string> = {
  DIARIO: "bg-red-100 text-red-700 border-red-200",
  SEMANAL: "bg-blue-100 text-blue-700 border-blue-200",
  MENSUAL: "bg-emerald-100 text-emerald-700 border-emerald-200",
  TRIMESTRAL: "bg-purple-100 text-purple-700 border-purple-200",
  ANUAL: "bg-amber-100 text-amber-700 border-amber-200",
  "POR NECESIDAD": "bg-slate-100 text-slate-700 border-slate-200",
  OTRO: "bg-muted text-muted-foreground border-border",
};

const ORDEN_FREC: Frecuencia[] = [
  "DIARIO",
  "SEMANAL",
  "MENSUAL",
  "TRIMESTRAL",
  "ANUAL",
  "POR NECESIDAD",
  "OTRO",
];

export function EquipoCronogramaView() {
  const { data, isLoading } = useCronogramasOperativos();
  const [selectedRol, setSelectedRol] = useState<string | null>(null);

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const t of data) {
      if (t.rol) set.add(t.rol);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const tareasPorRol = useMemo(() => {
    if (!selectedRol) return [];
    return data
      .filter((t) => t.rol === selectedRol && !t.parent_id)
      .sort((a, b) => {
        const fa = ORDEN_FREC.indexOf((a.frecuencia ?? "OTRO") as Frecuencia);
        const fb = ORDEN_FREC.indexOf((b.frecuencia ?? "OTRO") as Frecuencia);
        if (fa !== fb) return fa - fb;
        return (a.orden ?? 0) - (b.orden ?? 0);
      });
  }, [data, selectedRol]);

  const subtareas = useMemo(() => {
    const map = new Map<string, CronogramaOperativo[]>();
    for (const t of data) {
      if (t.parent_id) {
        const arr = map.get(t.parent_id) ?? [];
        arr.push(t);
        map.set(t.parent_id, arr);
      }
    }
    return map;
  }, [data]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <Card className="p-3 md:p-4 bg-muted/40 border-dashed">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Vista solo lectura — la edición está disponible para Dirección.
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : selectedRol ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selectedRol}</h2>
            <button
              type="button"
              onClick={() => setSelectedRol(null)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Cambiar departamento
            </button>
          </div>

          {tareasPorRol.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Aún no hay tareas registradas para este departamento.
            </Card>
          ) : (
            <ul className="space-y-2">
              {tareasPorRol.map((t) => {
                const subs = subtareas.get(t.id) ?? [];
                const freq = (t.frecuencia ?? "OTRO") as string;
                return (
                  <li key={t.id}>
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{t.tarea}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${FRECUENCIA_COLOR[freq] ?? FRECUENCIA_COLOR.OTRO}`}
                            >
                              {freq}
                            </Badge>
                            {t.tiempo_requerido && (
                              <span className="text-[11px] text-muted-foreground">
                                · {t.tiempo_requerido}
                              </span>
                            )}
                          </div>
                          {t.resumen && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {t.resumen}
                            </p>
                          )}
                          {subs.length > 0 && (
                            <ul className="mt-2 ml-3 border-l pl-3 space-y-1">
                              {subs
                                .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                                .map((sub) => (
                                  <li
                                    key={sub.id}
                                    className="text-xs text-muted-foreground"
                                  >
                                    • {sub.tarea}
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.length === 0 ? (
            <Card className="col-span-full p-6 text-center text-sm text-muted-foreground">
              La empresa aún no tiene cronogramas configurados.
            </Card>
          ) : (
            roles.map((rol) => {
              const total = data.filter((t) => t.rol === rol && !t.parent_id).length;
              return (
                <button
                  key={rol}
                  type="button"
                  onClick={() => setSelectedRol(rol)}
                  className="group text-left"
                >
                  <Card className="p-4 hover:shadow-md hover:border-primary transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold uppercase tracking-wide text-sm">
                          {rol}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {total} {total === 1 ? "tarea" : "tareas"} principal
                          {total === 1 ? "" : "es"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </Card>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
