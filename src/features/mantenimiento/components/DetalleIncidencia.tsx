import { useState } from "react";
import { Incidencia, Actualizacion, formatearDuracion } from "@/features/empresa/data/mantenimiento";
import { ActualizarIncidenciaDialog } from "@/features/mantenimiento/components/ActualizarIncidenciaDialog";
import { tiempoTranscurrido } from "@/shared/lib/timeUtils";
import { cn } from "@/lib/utils";
import { StatusBadge, GravedadBadge } from "@/features/mantenimiento/components/Badges";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, Plus, User, CalendarDays, MessageSquare } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  item: Incidencia;
  onAddActualizacion: (incidenciaId: string, act: Actualizacion) => void;
}

export function DetalleIncidencia({ open, onClose, item, onAddActualizacion }: Props) {
  const hoy = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);

  const tiempoDesdeCreacion = tiempoTranscurrido(item.fechaPublicado, hoy);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-bold">MÁS INFORMACIÓN</SheetTitle>
        </SheetHeader>

        {/* Summary */}
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-foreground text-base">{item.desperfecto}</h3>
            <p className="text-sm text-muted-foreground mt-1">{item.comentarios}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">LOCAL</span>
              <p className="font-medium text-foreground">{item.local}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">ESTADO</span>
              <div className="mt-0.5"><StatusBadge value={item.estado} /></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">GRAVEDAD</span>
              <div className="mt-0.5"><GravedadBadge value={item.gravedad} /></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">REPARADOR</span>
              <p className="font-medium text-foreground">{item.reparador}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">APUNTADA POR</span>
              <p className="font-medium text-foreground">{item.apuntaDesperfecto}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">FECHA PUBLICADO</span>
              <p className="font-medium text-foreground">{item.fechaPublicado}</p>
            </div>
          </div>

          {/* Elapsed time block */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-muted-foreground">TIEMPO TRANSCURRIDO DESDE LA CREACIÓN</p>
              <p className="text-lg font-black text-primary">{tiempoDesdeCreacion}</p>
            </div>
          </div>

          <Separator />

          {/* Updates section */}
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground text-sm">HISTORIAL DE ACTUALIZACIONES</h4>
            <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> ACTUALIZAR
            </Button>
          </div>

          <ActualizarIncidenciaDialog
            open={showForm}
            onClose={() => setShowForm(false)}
            item={item}
            onGuardar={({ texto, fecha, apuntadoPor, resultado, minutos }) => {
              onAddActualizacion(item.id, {
                id: crypto.randomUUID(),
                texto,
                fecha,
                apuntadoPor,
                resultado,
                minutos,
              });
            }}
          />

          {/* Timeline */}
          {item.actualizaciones.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground text-center py-6">No hay actualizaciones registradas para este desperfecto.</p>
          )}

          <div className="space-y-0">
            {item.actualizaciones.map((act, idx) => {
              const prevFecha = idx === 0 ? item.fechaPublicado : item.actualizaciones[idx - 1].fecha;
              const desdeCreacion = tiempoTranscurrido(item.fechaPublicado, act.fecha);
              const desdeUltima = tiempoTranscurrido(prevFecha, act.fecha);

              return (
                <div key={act.id} className="relative pl-6 pb-6 last:pb-0">
                  {/* Timeline line */}
                  {idx < item.actualizaciones.length - 1 && (
                    <div className="absolute left-[9px] top-5 bottom-0 w-0.5 bg-border" />
                  )}
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>

                  <div className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="font-semibold">{act.fecha}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-semibold">{act.apuntadoPor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border",
                        act.resultado === "TERMINADO"
                          ? "bg-status-done/15 text-status-done border-status-done/30"
                          : "bg-status-progress/15 text-status-progress border-status-progress/30"
                      )}>
                        {act.resultado}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> Dedicado:{" "}
                        <strong className="text-foreground">{formatearDuracion(act.minutos)}</strong>
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{act.texto}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Desde creación: <strong className="text-foreground">{desdeCreacion}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Desde última actualización: <strong className="text-foreground">{desdeUltima}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
