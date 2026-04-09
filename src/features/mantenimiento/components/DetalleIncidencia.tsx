import { useState } from "react";
import { Incidencia, Actualizacion, AREAS } from "@/features/empresa/data/mantenimiento";
import { tiempoTranscurrido } from "@/shared/lib/timeUtils";
import { StatusBadge, GravedadBadge } from "@/features/mantenimiento/components/Badges";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [apuntadoPor, setApuntadoPor] = useState(AREAS[0]);

  const handleAdd = () => {
    if (!texto.trim()) return;
    const act: Actualizacion = {
      id: crypto.randomUUID(),
      texto: texto.trim(),
      fecha,
      apuntadoPor,
    };
    onAddActualizacion(item.id, act);
    setTexto("");
    setFecha(hoy);
    setApuntadoPor(AREAS[0]);
    setShowForm(false);
  };

  const tiempoDesdeCreacion = tiempoTranscurrido(item.fechaPublicado, hoy);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
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
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-3.5 w-3.5" /> AÑADIR ACTUALIZACIÓN
            </Button>
          </div>

          {/* New update form */}
          {showForm && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <Label className="text-xs font-bold">ACTUALIZAR DESPERFECTO</Label>
                <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Detalle de la actualización..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">FECHA DE ACTUALIZACIÓN</Label>
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-bold">APUNTADO POR</Label>
                  <Select value={apuntadoPor} onValueChange={setApuntadoPor}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>CANCELAR</Button>
                <Button size="sm" onClick={handleAdd}>GUARDAR ACTUALIZACIÓN</Button>
              </div>
            </div>
          )}

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
