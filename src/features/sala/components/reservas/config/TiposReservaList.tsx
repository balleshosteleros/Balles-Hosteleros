"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ReservaTipo } from "@/features/sala/data/reservas";
import {
  createReservaTipo,
  updateReservaTipo,
  deleteReservaTipo,
} from "@/features/sala/actions/reserva-tipos-actions";

const EMOJI_CATALOG: string[] = [
  "🎂", "🎉", "🎈", "🎁", "🥂", "🍾", "🍰", "🍽️",
  "💍", "💖", "❤️", "👰", "🤵", "👶", "👨‍👩‍👧", "🎓",
  "🏆", "⭐", "🌟", "✨", "🎄", "🎃", "🦃", "🌹",
  "🍷", "🍻", "🥳", "🎵", "🎷", "🎤", "🕺", "💃",
  "🏢", "💼", "🤝", "📅", "📌", "📍", "🔔", "📣",
];

interface Props {
  tipos: ReservaTipo[];
  onChange: () => void;
}

export function TiposReservaList({ tipos, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmoji, setNuevoEmoji] = useState<string>("🎉");
  const [nuevoColor, setNuevoColor] = useState("#7c3aed");
  const [creando, setCreando] = useState(false);

  function resetForm() {
    setNuevoNombre("");
    setNuevoEmoji("🎉");
    setNuevoColor("#7c3aed");
  }

  async function handleCreate() {
    if (!nuevoNombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setCreando(true);
    const res = await createReservaTipo({
      nombre: nuevoNombre,
      emoji: nuevoEmoji || null,
      color: nuevoColor,
      orden: tipos.length + 1,
    });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear");
      return;
    }
    toast.success("Tipo añadido");
    resetForm();
    setModalOpen(false);
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
      <header className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Tipos de reserva</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Etiquetas visuales para clasificar reservas (Cumpleaños, Evento, …).
            No vinculan con políticas ni cupos — solo sirven para filtrar y pintar
            un chip de color.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />Nuevo tipo
        </Button>
      </header>

      <div className="border rounded-md divide-y">
        {tipos.map((t) => (
          <div key={t.id} className="flex items-center gap-2 p-2">
            <EmojiPicker
              value={t.emoji ?? ""}
              onChange={(v) => patch(t.id, { emoji: v || null })}
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
            Sin tipos. Crea el primero con &quot;Nuevo tipo&quot;.
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo tipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Icono</Label>
              <EmojiPicker value={nuevoEmoji} onChange={setNuevoEmoji} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <Input
                type="color"
                value={nuevoColor}
                onChange={(e) => setNuevoColor(e.target.value)}
                className="h-9 w-16 p-0.5 cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input
                placeholder="Ej: Cumpleaños, Evento"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!nuevoNombre.trim() || creando}
              >
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-14 justify-between gap-1 px-1.5 text-base"
          title="Elegir icono"
        >
          <span className="leading-none">{value || "🎉"}</span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_CATALOG.map((e) => {
            const active = e === value;
            return (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-md border text-lg transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-muted"
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
