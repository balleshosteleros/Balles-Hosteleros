"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  COLORES_PASTEL_ZONAS,
  type Sala,
  type Zona,
} from "@/features/sala/planos/data/planos";
import { createZona, updateZona, deleteZona } from "@/features/sala/planos/actions/zonas-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  zona?: Zona | null;
  localId: string;
  salas: Sala[];
  onSaved?: () => void;
  onDeleted?: () => void;
}

export function ZonaConfigModal({
  open,
  onOpenChange,
  zona,
  localId,
  salas,
  onSaved,
  onDeleted,
}: Props) {
  const esEdicion = !!zona;
  const [nombre, setNombre] = useState("");
  const [salaId, setSalaId] = useState("");
  const [color, setColor] = useState(COLORES_PASTEL_ZONAS[0]);
  const [saving, setSaving] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  useEffect(() => {
    if (open) {
      setNombre(zona?.nombre ?? "");
      setSalaId(zona?.salaId ?? salas[0]?.id ?? "");
      setColor(zona?.colorPastel ?? COLORES_PASTEL_ZONAS[0]);
    }
  }, [open, zona, salas]);

  const guardarBloqueado = !nombre.trim() || !salaId || saving;

  async function handleSave() {
    if (guardarBloqueado) return;
    setSaving(true);
    try {
      if (esEdicion && zona) {
        const res = await updateZona(zona.id, {
          nombre,
          salaId,
          colorPastel: color,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo actualizar");
          return;
        }
        toast.success("Zona actualizada");
      } else {
        const res = await createZona({
          localId,
          salaId,
          nombre,
          colorPastel: color,
        });
        if (!res.ok) {
          toast.error(res.error ?? "No se pudo crear");
          return;
        }
        toast.success("Zona creada");
      }
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!zona) return;
    const ok = await confirmDelete({
      title: `Borrar la zona "${zona.nombre}"`,
      description: "Las mesas asociadas bloquearán el borrado.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const res = await deleteZona(zona.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Zona borrada");
    onOpenChange(false);
    onDeleted?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{esEdicion ? `Zona: ${zona?.nombre}` : "Nueva zona"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Terraza interior"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Sala</Label>
            <select
              value={salaId}
              onChange={(e) => setSalaId(e.target.value)}
              className="h-9 text-sm w-full rounded-md border border-input bg-background px-2"
            >
              {salas.length === 0 && <option value="">— No hay salas creadas —</option>}
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Color pastel</Label>
            <div className="grid grid-cols-10 gap-1.5">
              {COLORES_PASTEL_ZONAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 rounded-md border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            {esEdicion ? (
              <Button variant="destructive" size="sm" onClick={handleDelete} type="button">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Borrar
              </Button>
            ) : (
              <div />
            )}
            <Button size="sm" onClick={handleSave} disabled={guardarBloqueado}>
              {esEdicion ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </div>
      </DialogContent>
      {confirmDeleteDialog}
    </Dialog>
  );
}
