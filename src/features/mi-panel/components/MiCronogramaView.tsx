"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, ListTodo, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getMiCronograma,
  type MiCronogramaDepartamento,
  type MiCronogramaTarea,
} from "@/features/mi-panel/actions/cronograma-actions";

const FRECUENCIA_COLOR: Record<string, string> = {
  DIARIO: "bg-red-100 text-red-700 border-red-200",
  SEMANAL: "bg-blue-100 text-blue-700 border-blue-200",
  MENSUAL: "bg-emerald-100 text-emerald-700 border-emerald-200",
  TRIMESTRAL: "bg-purple-100 text-purple-700 border-purple-200",
  ANUAL: "bg-amber-100 text-amber-700 border-amber-200",
  "POR NECESIDAD": "bg-slate-100 text-slate-700 border-slate-200",
  OTRO: "bg-muted text-muted-foreground border-border",
};

const ORDEN_FREC = [
  "DIARIO",
  "SEMANAL",
  "MENSUAL",
  "TRIMESTRAL",
  "ANUAL",
  "POR NECESIDAD",
  "OTRO",
] as const;

type EstadoCarga =
  | { kind: "loading" }
  | { kind: "error"; mensaje: string }
  | {
      kind: "ready";
      rolLabel: string | null;
      departamentos: MiCronogramaDepartamento[];
    };

function normalizarFrecuencia(f: string | null | undefined): string {
  const v = (f ?? "OTRO").toUpperCase().trim();
  return (ORDEN_FREC as readonly string[]).includes(v) ? v : "OTRO";
}

type Grupo = { frecuencia: string; tareas: MiCronogramaTarea[] };

function agruparPorFrecuencia(tareas: MiCronogramaTarea[]): Grupo[] {
  const principales = tareas.filter((t) => !t.parent_id);
  const acc = new Map<string, MiCronogramaTarea[]>();
  for (const t of principales) {
    const key = normalizarFrecuencia(t.frecuencia);
    const arr = acc.get(key) ?? [];
    arr.push(t);
    acc.set(key, arr);
  }
  for (const arr of acc.values()) {
    arr.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }
  return ORDEN_FREC
    .map((f) => ({ frecuencia: f as string, tareas: acc.get(f) ?? [] }))
    .filter((g) => g.tareas.length > 0);
}

function indexarSubtareas(
  tareas: MiCronogramaTarea[],
): Map<string, MiCronogramaTarea[]> {
  const map = new Map<string, MiCronogramaTarea[]>();
  for (const t of tareas) {
    if (!t.parent_id) continue;
    const arr = map.get(t.parent_id) ?? [];
    arr.push(t);
    map.set(t.parent_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }
  return map;
}

function ListaCronograma({ tareas }: { tareas: MiCronogramaTarea[] }) {
  const grupos = useMemo(() => agruparPorFrecuencia(tareas), [tareas]);
  const subtareasPorPadre = useMemo(() => indexarSubtareas(tareas), [tareas]);

  if (grupos.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">
          Aún no hay tareas registradas para este departamento
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {grupos.map(({ frecuencia, tareas: tareasGrupo }) => (
        <section key={frecuencia} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] ${FRECUENCIA_COLOR[frecuencia] ?? FRECUENCIA_COLOR.OTRO}`}
            >
              {frecuencia}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {tareasGrupo.length} {tareasGrupo.length === 1 ? "tarea" : "tareas"}
            </span>
          </div>
          <ul className="space-y-2">
            {tareasGrupo.map((t) => {
              const subs = subtareasPorPadre.get(t.id) ?? [];
              return (
                <li key={t.id}>
                  <Card className="p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{t.tarea}</span>
                        {t.tiempo_requerido && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            {t.tiempo_requerido}
                          </span>
                        )}
                      </div>
                      {t.resumen && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.resumen}
                        </p>
                      )}
                      {subs.length > 0 && (
                        <ul className="mt-2 ml-3 border-l pl-3 space-y-1">
                          {subs.map((sub) => (
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
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function MiCronogramaView() {
  const [estado, setEstado] = useState<EstadoCarga>({ kind: "loading" });
  const [activo, setActivo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMiCronograma();
      if (cancelled) return;
      if (!res.ok) {
        setEstado({ kind: "error", mensaje: res.error });
        return;
      }
      setEstado({
        kind: "ready",
        rolLabel: res.data.rolLabel,
        departamentos: res.data.departamentos,
      });
      if (res.data.departamentos[0]) {
        setActivo(res.data.departamentos[0].rol);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (estado.kind === "loading") {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (estado.kind === "error") {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <Card className="p-6 border-destructive/40 bg-destructive/5 text-sm text-destructive">
          No se pudo cargar el cronograma: {estado.mensaje}
        </Card>
      </div>
    );
  }

  const { rolLabel, departamentos } = estado;
  const totalTareas = departamentos.reduce(
    (acc, d) => acc + d.tareas.filter((t) => !t.parent_id).length,
    0,
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-violet-700">
            <CalendarClock className="h-5 w-5" />
            <span className="text-xs uppercase tracking-[0.2em] font-medium">
              Cronograma de mi puesto
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold mt-1 truncate">
            {rolLabel ?? "Sin puesto asignado"}
          </h1>
          {departamentos.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {departamentos.length === 1
                ? `Departamento · ${departamentos[0].label}`
                : `${departamentos.length} departamentos asignados`}
            </p>
          )}
        </div>
        {totalTareas > 0 && (
          <Badge variant="outline" className="text-[11px]">
            {totalTareas} {totalTareas === 1 ? "tarea" : "tareas"}
          </Badge>
        )}
      </header>

      {!rolLabel ? (
        <Card className="p-8 text-center">
          <ListTodo className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Aún no tienes un puesto asignado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pide a Dirección o RRHH que te asigne un rol para ver tu cronograma.
          </p>
        </Card>
      ) : departamentos.length === 0 ? (
        <Card className="p-8 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">
            Aún no hay tareas registradas para tu puesto
          </p>
        </Card>
      ) : departamentos.length === 1 ? (
        <ListaCronograma tareas={departamentos[0].tareas} />
      ) : (
        <Tabs
          value={activo ?? departamentos[0].rol}
          onValueChange={setActivo}
          className="w-full"
        >
          <TabsList className="flex flex-wrap h-auto justify-start">
            {departamentos.map((d) => {
              const principales = d.tareas.filter((t) => !t.parent_id).length;
              return (
                <TabsTrigger key={d.rol} value={d.rol} className="gap-2">
                  <span>{d.label}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {principales}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {departamentos.map((d) => (
            <TabsContent key={d.rol} value={d.rol} className="mt-5">
              <ListaCronograma tareas={d.tareas} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
