"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  crearCampana,
  listPlantillas,
} from "@/features/calidad/cuestionarios/actions";
import {
  listadoPeriodos,
  periodoActual,
} from "@/features/calidad/cuestionarios/types";
import type { PlantillaCuestionario } from "@/features/calidad/cuestionarios/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreada: (campanaId: string) => void;
}

export function NuevaCampanaDialog({ open, onOpenChange, onCreada }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaCuestionario[]>([]);
  const [plantillaId, setPlantillaId] = useState<string>("");
  const [periodo, setPeriodo] = useState<string>(periodoActual());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    listPlantillas().then((data) => {
      const activas = data.filter((p) => !p.archivada);
      setPlantillas(activas);
      if (activas.length > 0) setPlantillaId(activas[0].id);
    });
  }, [open]);

  async function onSubmit() {
    if (!plantillaId) {
      toast.error("Selecciona una plantilla");
      return;
    }
    setSubmitting(true);
    const res = await crearCampana({ plantillaId, periodo });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Campaña creada · ${res.envios} envíos generados`);
    onOpenChange(false);
    onCreada(res.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva campaña</DialogTitle>
          <DialogDescription>
            Se generará un envío por cada empleado activo de la empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Cuestionario</Label>
            <select
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            >
              {plantillas.length === 0 ? (
                <option value="">No hay plantillas disponibles</option>
              ) : (
                plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Periodo</Label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
            >
              {listadoPeriodos().map((p) => (
                <option key={p} value={p}>
                  {labelPeriodo(p)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !plantillaId}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear campaña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function labelPeriodo(p: string): string {
  const [year, semestre] = p.split("-");
  return semestre === "S1"
    ? `${year} · Enero – Junio`
    : `${year} · Julio – Diciembre`;
}
