"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Hand,
  ListTodo,
  Loader2,
  Table2,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getMiCronograma,
  type MiCronogramaDepartamento,
  type MiCronogramaTarea,
} from "@/features/mi-panel/actions/cronograma-actions";
import { CalendarioCronograma } from "@/features/direccion/components/cronogramas/CalendarioCronograma";
import { BadgesDiasTarea } from "@/features/direccion/components/cronogramas/SelectorDiasTarea";
import {
  type CronogramaOperativo,
  type Frecuencia,
} from "@/features/direccion/hooks/useCronogramasOperativos";
import {
  AREA_BADGE_CLASS,
  AREA_LABEL,
} from "@/features/direccion/data/cronogramaAreas";

const ORDERED_FREQUENCIES: Frecuencia[] = [
  "DIARIO",
  "SEMANAL",
  "MENSUAL",
  "TRIMESTRAL",
  "ANUAL",
  "POR NECESIDAD",
];

type EstadoCarga =
  | { kind: "loading" }
  | { kind: "error"; mensaje: string }
  | {
      kind: "ready";
      rolLabel: string | null;
      departamentos: MiCronogramaDepartamento[];
    };

interface Grupo {
  main: CronogramaOperativo;
  subs: CronogramaOperativo[];
}

function toCronogramaOperativo(t: MiCronogramaTarea): CronogramaOperativo {
  return {
    id: t.id,
    rol: t.rol,
    departamento: t.departamento ?? null,
    tarea: t.tarea,
    frecuencia: (t.frecuencia ?? "OTRO") as Frecuencia,
    formacion: t.formacion ?? undefined,
    tiempo_requerido: t.tiempo_requerido ?? undefined,
    resumen: t.resumen ?? null,
    video_url: t.video_url ?? null,
    id_visible: t.id_visible ?? null,
    parent_id: t.parent_id ?? null,
    orden: t.orden ?? undefined,
    dia_semana: t.dia_semana ?? null,
    dia_mes: t.dia_mes ?? null,
    fecha_anual: t.fecha_anual ?? null,
    meses_trimestrales: t.meses_trimestrales ?? null,
    empleados_asignados: t.empleados_asignados ?? null,
    intervalo: t.intervalo ?? null,
    termina_tipo: t.termina_tipo ?? null,
    termina_fecha: t.termina_fecha ?? null,
    termina_repeticiones: t.termina_repeticiones ?? null,
    fecha_inicio: t.fecha_inicio ?? null,
  };
}

function buildGrupos(tareas: CronogramaOperativo[]): Grupo[] {
  const mains = tareas.filter((t) => !t.parent_id);
  const subsByParent = new Map<string, CronogramaOperativo[]>();
  for (const t of tareas) {
    if (t.parent_id) {
      const arr = subsByParent.get(t.parent_id) ?? [];
      arr.push(t);
      subsByParent.set(t.parent_id, arr);
    }
  }
  return mains
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((m) => ({
      main: m,
      subs: (subsByParent.get(m.id) ?? []).sort(
        (a, b) => (a.orden ?? 0) - (b.orden ?? 0),
      ),
    }));
}

function DepartamentoCronograma({
  tareas,
  onTareaClick,
}: {
  tareas: MiCronogramaTarea[];
  onTareaClick: (t: CronogramaOperativo) => void;
}) {
  const [vistaModo, setVistaModo] = useState<"TABLA" | "CALENDARIO">("TABLA");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const tareasNorm = useMemo(
    () => tareas.map(toCronogramaOperativo),
    [tareas],
  );
  const grupos = useMemo(() => buildGrupos(tareasNorm), [tareasNorm]);

  const toggleGroup = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedGroups((p) => ({
      ...p,
      [id]: p[id] === undefined ? false : !p[id],
    }));
  };

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <div className="inline-flex p-0.5 rounded-lg bg-muted/40 border">
          <button
            type="button"
            onClick={() => setVistaModo("TABLA")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all",
              vistaModo === "TABLA"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Vista tabla"
          >
            <Table2 className="h-3.5 w-3.5" />
            Tabla
          </button>
          <button
            type="button"
            onClick={() => setVistaModo("CALENDARIO")}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all",
              vistaModo === "CALENDARIO"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Vista calendario"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Calendario
          </button>
        </div>
      </div>

      {vistaModo === "CALENDARIO" ? (
        <CalendarioCronograma grupos={grupos} onTareaClick={onTareaClick} />
      ) : (
        <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1000px] border-collapse bg-card text-sm">
              <thead>
                <tr className="bg-muted/20 text-muted-foreground uppercase text-xs tracking-wider border-b border-border/30 font-semibold">
                  <th className="py-4 px-3 w-[6%] text-center">ID</th>
                  <th className="py-4 px-4 text-left w-[40%]">
                    Tarea a ejecutar
                  </th>
                  {ORDERED_FREQUENCIES.map((f) => {
                    const isManual = f === "POR NECESIDAD";
                    return (
                      <th
                        key={f}
                        className={cn(
                          "py-4 px-2 text-center w-[9%]",
                          isManual &&
                            "border-l border-r border-dashed border-amber-300/50 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/15 text-amber-800 dark:text-amber-300",
                        )}
                      >
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {isManual && <Hand className="h-3 w-3" />}
                          <span>{f}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => {
                  const isExpanded = expandedGroups[g.main.id] !== false;
                  const hasSubs = g.subs.length > 0;
                  return (
                    <Fragment key={g.main.id}>
                      <FilaTarea
                        item={g.main}
                        isSub={false}
                        hasSubs={hasSubs}
                        isExpanded={isExpanded}
                        onToggle={(e) => toggleGroup(g.main.id, e)}
                        onClick={() => onTareaClick(g.main)}
                      />
                      {isExpanded &&
                        hasSubs &&
                        g.subs.map((sub) => (
                          <FilaTarea
                            key={sub.id}
                            item={sub}
                            isSub
                            hasSubs={false}
                            isExpanded={false}
                            onToggle={() => {}}
                            onClick={() => onTareaClick(sub)}
                          />
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaTarea({
  item,
  isSub,
  hasSubs,
  isExpanded,
  onToggle,
  onClick,
}: {
  item: CronogramaOperativo;
  isSub: boolean;
  hasSubs: boolean;
  isExpanded: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  return (
    <tr
      className={cn(
        "group transition-colors cursor-pointer",
        isSub
          ? "bg-muted/5 hover:bg-muted/10"
          : "hover:bg-muted/10 border-b border-border/25",
      )}
      onClick={onClick}
    >
      <td className="px-3 py-3 text-center text-xs tabular-nums font-medium text-muted-foreground/70 align-middle whitespace-nowrap">
        {item.id_visible || "—"}
      </td>

      <td
        className={cn(
          "px-4 py-3 align-middle",
          isSub && "pl-10 text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-2">
          {!isSub && hasSubs ? (
            <button
              className="p-1 hover:bg-muted rounded text-muted-foreground"
              onClick={onToggle}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
          {isSub && <span className="w-3 h-px bg-border/80" />}
          <div className={cn("flex-1", !isSub && "font-medium text-foreground")}>
            <div className="flex items-center gap-2 flex-wrap">
              <span>{item.tarea}</span>
              {item.video_url && (
                <Video className="inline-block h-3.5 w-3.5 text-emerald-600" />
              )}
            </div>
            {!isSub && (
              <div className="mt-1.5">
                <BadgesDiasTarea
                  frecuencia={item.frecuencia}
                  dia_semana={item.dia_semana}
                  dia_mes={item.dia_mes}
                  fecha_anual={item.fecha_anual}
                  meses_trimestrales={item.meses_trimestrales}
                  intervalo={item.intervalo}
                  termina_tipo={item.termina_tipo}
                  termina_fecha={item.termina_fecha}
                  termina_repeticiones={item.termina_repeticiones}
                />
              </div>
            )}
          </div>
        </div>
      </td>

      {ORDERED_FREQUENCIES.map((freq) => {
        const isActive = item.frecuencia === freq;
        const isManual = freq === "POR NECESIDAD";
        return (
          <td
            key={freq}
            className={cn(
              "px-2 py-3 text-center align-middle",
              isManual &&
                "border-l border-r border-dashed border-amber-300/40 dark:border-amber-700/30 bg-amber-50/15 dark:bg-amber-950/10",
              isActive && !isManual && "bg-primary/5",
              isActive && isManual && "bg-amber-100/50 dark:bg-amber-950/25",
            )}
          >
            {isActive ? (
              <span
                className={cn(
                  "font-bold text-[11px] tracking-wider inline-flex items-center gap-1",
                  isManual
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-primary",
                )}
              >
                {isManual && <Hand className="h-3 w-3" />}
                {item.tiempo_requerido || "✓"}
              </span>
            ) : (
              <span
                className={cn(
                  "text-muted-foreground/30",
                  isManual && "text-amber-600/30",
                )}
              >
                —
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function DetalleTareaReadOnly({
  tarea,
  onClose,
}: {
  tarea: CronogramaOperativo;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-10">
            {tarea.id_visible && (
              <Badge
                variant="outline"
                className="text-xs tabular-nums font-medium px-2 py-1 mt-1"
              >
                ID {tarea.id_visible}
              </Badge>
            )}
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold leading-tight">
                {tarea.tarea}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground block">
                {tarea.departamento ? "Puesto · Departamento" : "Departamento"}
              </span>
              <span className="font-medium">
                {tarea.rol}
                {tarea.departamento && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {tarea.departamento}
                  </span>
                )}
              </span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground block">
                Calendario
              </span>
              <BadgesDiasTarea
                frecuencia={tarea.frecuencia}
                dia_semana={tarea.dia_semana}
                dia_mes={tarea.dia_mes}
                fecha_anual={tarea.fecha_anual}
                meses_trimestrales={tarea.meses_trimestrales}
                intervalo={tarea.intervalo}
                termina_tipo={tarea.termina_tipo}
                termina_fecha={tarea.termina_fecha}
                termina_repeticiones={tarea.termina_repeticiones}
              />
            </div>
          </div>

          {tarea.video_url && (
            <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
              <div className="w-40 aspect-video rounded-md border bg-black/5 dark:bg-black/30 flex items-center justify-center overflow-hidden shrink-0">
                <video
                  src={tarea.video_url}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-bold flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" /> Video formativo
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reproduce el vídeo para ver la formación.
                </p>
              </div>
            </div>
          )}

          {tarea.tiempo_requerido && (
            <div>
              <Label className="text-sm font-bold mb-1 block">
                Tiempo requerido
              </Label>
              <Badge variant="outline" className="font-mono text-xs">
                {tarea.tiempo_requerido}
              </Badge>
            </div>
          )}

          {tarea.resumen && (
            <div>
              <Label className="text-sm font-bold mb-2 block">Resumen</Label>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {tarea.resumen}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MiCronogramaView() {
  const [estado, setEstado] = useState<EstadoCarga>({ kind: "loading" });
  const [activo, setActivo] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<CronogramaOperativo | null>(null);

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
      const primeraConTareas = res.data.departamentos.find(
        (d) => d.tareas.length > 0,
      );
      const inicial = primeraConTareas ?? res.data.departamentos[0];
      if (inicial) setActivo(inicial.rol);
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
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="p-6 border-destructive/40 bg-destructive/5 text-sm text-destructive">
          No se pudo cargar el cronograma: {estado.mensaje}
        </Card>
      </div>
    );
  }

  const { rolLabel, departamentos } = estado;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
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
        <DepartamentoCronograma
          tareas={departamentos[0].tareas}
          onTareaClick={setDetalle}
        />
      ) : (
        <Tabs
          value={activo ?? departamentos[0].rol}
          onValueChange={setActivo}
          className="w-full"
        >
          <div className="flex flex-col gap-2">
            {(["OPERATIVA", "ADMINISTRATIVA"] as const).map((area) => {
              const grupo = departamentos.filter((d) => d.area === area);
              if (grupo.length === 0) return null;
              return (
                <div
                  key={area}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 shrink-0",
                      AREA_BADGE_CLASS[area],
                    )}
                  >
                    {AREA_LABEL[area]}
                  </Badge>
                  <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
                    {grupo.map((d) => {
                      const principales = d.tareas.filter(
                        (t) => !t.parent_id,
                      ).length;
                      const vacio = principales === 0;
                      return (
                        <TabsTrigger
                          key={d.rol}
                          value={d.rol}
                          className={cn(
                            "gap-2",
                            vacio && "opacity-60",
                          )}
                        >
                          <span>{d.label}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {principales}
                          </span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
              );
            })}
          </div>
          {departamentos.map((d) => (
            <TabsContent key={d.rol} value={d.rol} className="mt-5">
              <DepartamentoCronograma
                tareas={d.tareas}
                onTareaClick={setDetalle}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {detalle && (
        <DetalleTareaReadOnly
          tarea={detalle}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
