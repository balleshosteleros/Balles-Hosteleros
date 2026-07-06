"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getHorarioPuesto, setHorarioPuesto, type PatronElegible } from "@/features/rrhh/actions/puesto-horario-actions";
import type { Turno } from "@/features/rrhh/data/horarios";
import type { PuestoSalarial } from "@/features/rrhh/data/puestos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  puesto: PuestoSalarial | null;
  onSaved?: () => void;
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

export function PuestoHorarioDialog({ open, onOpenChange, puesto, onSaved }: Props) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [patrones, setPatrones] = useState<PatronElegible[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [inicial, setInicial] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !puesto) return;
    setLoading(true);
    getHorarioPuesto(puesto.id)
      .then((res) => {
        setTurnos(res.turnos);
        setPatrones(res.patrones);
        setSeleccion(res.familiaSeleccionada);
        setInicial(res.familiaSeleccionada);
      })
      .finally(() => setLoading(false));
  }, [open, puesto]);

  const turnoById = useMemo(() => {
    const m = new Map<string, Turno>();
    turnos.forEach((t) => m.set(t.id, t));
    return m;
  }, [turnos]);

  const handleSave = async () => {
    if (!puesto) return;
    setSaving(true);
    try {
      const res = await setHorarioPuesto(puesto.id, seleccion);
      if (!res.ok) { toast.error(res.error ?? "No se pudo guardar"); return; }
      toast.success(seleccion ? "Horario del puesto guardado" : "Horario del puesto quitado");
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  // Mini vista previa de la semana de un patrón (7 celdas de color).
  const Semana = ({ dias }: { dias: (string | null)[] }) => (
    <div className="grid grid-cols-7 gap-0.5">
      {DIAS.map((d, i) => {
        const t = dias[i] ? turnoById.get(dias[i]!) : null;
        return (
          <div key={d} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-muted-foreground">{d}</span>
            <span
              className={cn(
                "h-5 w-full rounded-sm flex items-center justify-center text-[9px] font-semibold",
                t ? "text-white" : "bg-muted text-muted-foreground/60",
              )}
              style={t ? { backgroundColor: t.colorHex } : undefined}
              title={t ? `${t.codigo} · ${t.nombre}` : "Libre"}
            >
              {t ? t.codigo : "·"}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Horario · {puesto?.puesto}</DialogTitle>
          <DialogDescription>
            El horario se crea en Horarios. Aquí eliges qué horario aplica a este puesto:
            queda en su plantilla y se hereda al empleado que se contrate para él.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Cargando…
          </div>
        ) : patrones.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No hay horarios creados. Créalos primero en Horarios → Patrones.
          </p>
        ) : (
          <div className="space-y-1.5 py-2">
            {/* Opción: sin horario */}
            <button
              type="button"
              onClick={() => setSeleccion(null)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                seleccion === null ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <span className={cn(
                "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                seleccion === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}>
                {seleccion === null ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              </span>
              <span className="text-sm font-medium">Sin horario asignado</span>
            </button>

            {patrones.map((p) => {
              const activo = seleccion === p.familiaId;
              return (
                <button
                  key={p.familiaId}
                  type="button"
                  onClick={() => setSeleccion(p.familiaId)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                    activo ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <span className={cn(
                    "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                    activo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    {activo ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate mb-1">{p.nombre}</span>
                    <Semana dias={p.dias} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading || seleccion === inicial}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
