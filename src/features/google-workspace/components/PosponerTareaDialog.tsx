"use client";

import { useState, useEffect } from "react";
import { Calendar, CalendarClock, Clock, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Calendar as CalendarComp } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { posponerTarea, type TareaRow } from "@/features/tareas/actions/tareas-actions";

interface Props {
  tarea:
    | (Pick<TareaRow, "id" | "titulo" | "fecha"> & {
        hora_inicio?: string | null;
        duracion_minutos?: number | null;
        pospuesta_count?: number;
      })
    | null;
  onClose: () => void;
  onDone: () => void;
}

function formatDuracion(min: number | null | undefined): string {
  if (!min || min <= 0) return "Sin duración";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function PosponerTareaDialog({ tarea, onClose, onDone }: Props) {
  const open = !!tarea;
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tarea) {
      setFecha(parseISO(tarea.fecha));
      setHora(tarea.hora_inicio?.slice(0, 5) ?? "");
    }
  }, [tarea]);

  const handleConfirm = async () => {
    if (!tarea || !fecha) return;
    setSaving(true);
    try {
      const res = await posponerTarea({
        id: tarea.id,
        nuevaFecha: format(fecha, "yyyy-MM-dd"),
        nuevaHora: hora ? `${hora}:00` : null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Tarea pospuesta");
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-violet-950">
            <CalendarClock className="h-4 w-4 text-violet-600" />
            Posponer tarea
          </DialogTitle>
        </DialogHeader>

        {tarea && (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-violet-50/60 border border-violet-100 px-3 py-2.5">
              <p className="text-xs uppercase tracking-wider font-bold text-violet-500 mb-1">
                Tarea
              </p>
              <p className="text-sm font-medium text-violet-950">{tarea.titulo}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-violet-700">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Duración fija: <strong>{formatDuracion(tarea.duracion_minutos)}</strong>
                </span>
                {(tarea.pospuesta_count ?? 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                    Pospuesta {tarea.pospuesta_count}×
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Nueva fecha
              </p>
              <div className="rounded-md border bg-white p-2 flex justify-center">
                <CalendarComp
                  mode="single"
                  selected={fecha}
                  onSelect={setFecha}
                  locale={es}
                  weekStartsOn={1}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return d < today;
                  }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Hora de inicio (opcional)
              </p>
              <Input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                La duración no se puede cambiar — solo cuándo empieza.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!fecha || saving}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {saving ? "Posponiendo…" : "Posponer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
