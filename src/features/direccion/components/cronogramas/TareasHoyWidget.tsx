"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Clock, Video, AlertTriangle, CalendarDays, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCronogramaEjecuciones,
  type EjecucionConTarea,
} from "../../hooks/useCronogramaEjecuciones";
import { toast } from "sonner";

function formatFechaLarga(d: Date) {
  return d.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function daysAgo(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const diff = Math.floor((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function TareasHoyWidget() {
  const { hoy, pendientes, isLoading, error, confirmar, refresh } = useCronogramaEjecuciones();
  const [detalle, setDetalle] = useState<EjecucionConTarea | null>(null);

  const hoyStr = useMemo(() => formatFechaLarga(new Date()), []);
  const hechasHoy = hoy.filter((e) => e.estado === "hecha").length;
  const totalHoy = hoy.length;
  const pctHoy = totalHoy > 0 ? Math.round((hechasHoy / totalHoy) * 100) : 0;

  const handleToggle = async (ejec: EjecucionConTarea, done: boolean) => {
    const res = await confirmar(ejec.id, done ? "hecha" : "pendiente");
    if (!res.ok) toast.error("No se pudo guardar: " + res.error);
  };

  if (error) {
    return (
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">No pudimos cargar tus tareas.</p>
            <p className="text-xs mt-1 text-amber-800">{error}</p>
            <p className="text-xs mt-2 text-amber-700">
              Puede que la migración 045 aún no esté aplicada. Contacta con Dirección.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Card tareas de hoy */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b px-5 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h3 className="text-base font-bold tracking-tight">Tus tareas de hoy</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{hoyStr}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">
                  {hechasHoy}<span className="text-muted-foreground">/{totalHoy}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {pctHoy}% completado
                </div>
              </div>
              {pctHoy === 100 && totalHoy > 0 && (
                <Flame className="h-8 w-8 text-amber-500" />
              )}
            </div>
          </div>

          <div className="divide-y">
            {isLoading ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Cargando…</div>
            ) : hoy.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No tienes tareas asignadas para hoy. ¡Buen día! 💪
              </div>
            ) : (
              hoy.map((ejec) => {
                const done = ejec.estado === "hecha";
                return (
                  <div
                    key={ejec.id}
                    className={cn(
                      "flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors",
                      done && "bg-emerald-50/50"
                    )}
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(v) => handleToggle(ejec, Boolean(v))}
                      className="mt-1"
                    />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setDetalle(ejec)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            done && "line-through text-muted-foreground"
                          )}
                        >
                          {ejec.tarea?.tarea ?? "(tarea eliminada)"}
                        </span>
                        {ejec.tarea?.video_url && (
                          <Video className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {ejec.tarea?.frecuencia ?? "—"}
                        </Badge>
                        {ejec.tarea?.tiempo_requerido && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {ejec.tarea.tiempo_requerido}
                          </span>
                        )}
                      </div>
                    </div>
                    {done && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Card pendientes */}
        {pendientes.length > 0 && (
          <Card className="overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">
                  Pendientes de días anteriores ({pendientes.length})
                </h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-amber-700 hover:text-amber-900 h-7"
                onClick={refresh}
              >
                Refrescar
              </Button>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {pendientes.slice(0, 20).map((ejec) => {
                const diasAtras = daysAgo(ejec.fecha_programada);
                return (
                  <div key={ejec.id} className="flex items-start gap-3 px-5 py-2.5 hover:bg-amber-50/40">
                    <Checkbox
                      checked={false}
                      onCheckedChange={(v) => v && handleToggle(ejec, true)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetalle(ejec)}>
                      <div className="text-sm">{ejec.tarea?.tarea}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Hace {diasAtras} {diasAtras === 1 ? "día" : "días"} · {ejec.fecha_programada}
                      </div>
                    </div>
                  </div>
                );
              })}
              {pendientes.length > 20 && (
                <div className="px-5 py-2 text-xs text-muted-foreground text-center">
                  … y {pendientes.length - 20} más
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Dialog detalle tarea */}
      {detalle && detalle.tarea && (
        <Dialog open onOpenChange={(o) => !o && setDetalle(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detalle.tarea.tarea}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{detalle.tarea.frecuencia}</Badge>
                {detalle.tarea.tiempo_requerido && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" /> {detalle.tarea.tiempo_requerido}
                  </Badge>
                )}
              </div>
              {detalle.tarea.resumen && (
                <div className="rounded-lg bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                  {detalle.tarea.resumen}
                </div>
              )}
              {detalle.tarea.video_url && (
                <div className="rounded-lg overflow-hidden border bg-black/5 aspect-video">
                  <video src={detalle.tarea.video_url} controls className="w-full h-full" />
                </div>
              )}
            </div>
            <DialogFooter>
              {detalle.estado !== "hecha" ? (
                <Button
                  variant="primary"
                  onClick={async () => {
                    await handleToggle(detalle, true);
                    setDetalle(null);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Marcar como hecha
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setDetalle(null)}>Cerrar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
