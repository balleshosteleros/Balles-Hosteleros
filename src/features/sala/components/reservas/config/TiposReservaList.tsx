"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ReservaTipo } from "@/features/sala/data/reservas";
import {
  createReservaTipo,
  updateReservaTipo,
  deleteReservaTipo,
} from "@/features/sala/actions/reserva-tipos-actions";

interface Props {
  tipos: ReservaTipo[];
  onChange: () => void;
}

export function TiposReservaList({ tipos, onChange }: Props) {
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmoji, setNuevoEmoji] = useState("");
  const [nuevoColor, setNuevoColor] = useState("#7c3aed");
  const [creando, setCreando] = useState(false);

  async function handleCreate() {
    if (!nuevoNombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setCreando(true);
    const res = await createReservaTipo({
      nombre: nuevoNombre,
      emoji: nuevoEmoji.trim() || null,
      color: nuevoColor,
      orden: tipos.length + 1,
    });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear");
      return;
    }
    toast.success("Tipo añadido");
    setNuevoNombre("");
    setNuevoEmoji("");
    setNuevoColor("#7c3aed");
    onChange();
  }

  async function patch(id: string, patch: Parameters<typeof updateReservaTipo>[1]) {
    const res = await updateReservaTipo(id, patch);
    if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    else onChange();
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Borrar el tipo "${nombre}"?`)) return;
    const res = await deleteReservaTipo(id);
    if (!res.ok) toast.error(res.error ?? "No se pudo borrar");
    else {
      toast.success("Tipo borrado");
      onChange();
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold mb-2">Tipos de reserva</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Etiquetas visuales para clasificar reservas (Cumpleaños, Evento, …).
          No vinculan con políticas ni cupos — solo sirven para filtrar y pintar
          un chip de color.
        </p>
      </div>

      <div className="border rounded-md divide-y">
        {tipos.map((t) => (
          <div key={t.id} className="flex items-center gap-2 p-2">
            <Input
              defaultValue={t.emoji ?? ""}
              maxLength={4}
              placeholder="🎉"
              onBlur={(e) =>
                e.target.value !== (t.emoji ?? "") &&
                patch(t.id, { emoji: e.target.value || null })
              }
              className="h-8 w-14 text-center"
            />
            <Input
              type="color"
              defaultValue={t.color}
              onBlur={(e) =>
                e.target.value !== t.color && patch(t.id, { color: e.target.value })
              }
              className="h-8 w-14 p-0.5 cursor-pointer"
            />
            <Input
              defaultValue={t.nombre}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== t.nombre &&
                patch(t.id, { nombre: e.target.value })
              }
              className="h-8 flex-1"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Switch
                checked={t.activo}
                onCheckedChange={(v) => patch(t.id, { activo: v })}
              />
              <span>{t.activo ? "Activo" : "Inactivo"}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => handleDelete(t.id, t.nombre)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {tipos.length === 0 && (
          <div className="p-3 text-center text-muted-foreground text-xs">
            Sin tipos. Añade uno abajo.
          </div>
        )}
      </div>

      <div className="border rounded-md p-3 bg-muted/30">
        <div className="text-xs font-medium mb-2">Añadir tipo</div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="🎉"
            maxLength={4}
            value={nuevoEmoji}
            onChange={(e) => setNuevoEmoji(e.target.value)}
            className="h-8 w-14 text-center"
          />
          <Input
            type="color"
            value={nuevoColor}
            onChange={(e) => setNuevoColor(e.target.value)}
            className="h-8 w-14 p-0.5 cursor-pointer"
          />
          <Input
            placeholder="Nombre del tipo"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="h-8 flex-1"
          />
          <Button size="sm" onClick={handleCreate} disabled={creando}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}
