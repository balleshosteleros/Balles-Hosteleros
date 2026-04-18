"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Send, X, AlertCircle } from "lucide-react";
import type { Fase, SubEstado } from "../types";
import type { RecetaConExtras } from "../actions/recetas-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receta: RecetaConExtras | null;
  faseAnterior: Fase | undefined;
  faseNueva: Fase | undefined;
  subEstadosNueva: SubEstado[];
  onConfirm: (params: {
    subEstadoId: string | null;
    nota: string;
    comunicar: boolean;
  }) => void | Promise<void>;
}

export function ConfirmarMovimientoDialog({
  open, onOpenChange, receta, faseAnterior, faseNueva, subEstadosNueva, onConfirm,
}: Props) {
  const [subEstadoId, setSubEstadoId] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [comunicar, setComunicar] = useState(true);

  if (!receta || !faseNueva) return null;

  const responsable = faseNueva.responsable_user_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Mover receta</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{receta.nombre}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {faseAnterior && (
                  <>
                    <Badge variant="outline">{faseAnterior.nombre}</Badge>
                    <span className="text-muted-foreground">→</span>
                  </>
                )}
                <Badge>{faseNueva.nombre}</Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {subEstadosNueva.length > 0 && (
            <div>
              <Label className="text-xs">Sub-estado</Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {subEstadosNueva.map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant={subEstadoId === s.id ? "default" : "outline"}
                    onClick={() => setSubEstadoId(s.id)}
                    className="text-xs h-7"
                  >
                    {s.nombre}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Nota (opcional)</Label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Contexto del cambio..."
              className="mt-1 w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          {!responsable && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 text-amber-900 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Esta fase no tiene responsable asignado. No se enviará tarea.</span>
            </div>
          )}

          {responsable && (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="comunicar"
                checked={comunicar}
                onCheckedChange={(v) => setComunicar(Boolean(v))}
              />
              <label htmlFor="comunicar" className="text-sm cursor-pointer">
                <span className="font-medium">Comunicar</span> — crea tarea al responsable de la fase
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                subEstadoId,
                nota: nota.trim(),
                comunicar: comunicar && Boolean(responsable),
              })
            }
          >
            <Send className="h-4 w-4 mr-1" />
            {comunicar && responsable ? "Mover y comunicar" : "Mover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
