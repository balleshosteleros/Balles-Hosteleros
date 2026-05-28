"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { EtiquetaChip } from "./EtiquetaChip";
import {
  createEtiqueta,
  deleteEtiqueta,
  deleteEtiquetaCategoria,
  updateEtiqueta,
  updateEtiquetaCategoria,
  type Etiqueta,
  type EtiquetaCategoria,
} from "@/features/sala/actions/sala-etiquetas-actions";

interface Props {
  categoria: EtiquetaCategoria;
  etiquetas: Etiqueta[];
  onChange: () => void;
}

export function CategoriaEtiquetasCard({ categoria, etiquetas, onChange }: Props) {
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreLocal, setNombreLocal] = useState(categoria.nombre);
  const [creandoEtiqueta, setCreandoEtiqueta] = useState(false);
  const [editandoEtiqueta, setEditandoEtiqueta] = useState<string | null>(null);

  async function handleRenameCategoria() {
    if (!nombreLocal.trim() || nombreLocal === categoria.nombre) {
      setEditandoNombre(false);
      setNombreLocal(categoria.nombre);
      return;
    }
    const res = await updateEtiquetaCategoria(categoria.id, { nombre: nombreLocal });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo renombrar");
      setNombreLocal(categoria.nombre);
    } else {
      onChange();
    }
    setEditandoNombre(false);
  }

  async function handleDeleteCategoria() {
    if (categoria.sistema) {
      toast.error("Las categorías del sistema no se pueden borrar.");
      return;
    }
    if (
      !confirm(
        `¿Borrar la categoría "${categoria.nombre}"? Las etiquetas dentro quedarán sin categoría.`,
      )
    )
      return;
    const res = await deleteEtiquetaCategoria(categoria.id);
    if (!res.ok) toast.error(res.error ?? "No se pudo borrar");
    else {
      toast.success("Categoría borrada");
      onChange();
    }
  }

  return (
    <div className="rounded-md border bg-card">
      {/* Header de categoría */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {editandoNombre ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              autoFocus
              value={nombreLocal}
              onChange={(e) => setNombreLocal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCategoria();
                if (e.key === "Escape") {
                  setNombreLocal(categoria.nombre);
                  setEditandoNombre(false);
                }
              }}
              className="h-7 text-sm"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleRenameCategoria}>
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <h5 className="text-sm font-semibold text-primary">{categoria.nombre}</h5>
            {categoria.sistema && (
              <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-px">
                sistema
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Añadir etiqueta"
            onClick={() => setCreandoEtiqueta(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {!categoria.sistema && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Renombrar categoría"
                onClick={() => setEditandoNombre(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Borrar categoría"
                onClick={handleDeleteCategoria}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Lista de etiquetas */}
      <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
        {etiquetas.length === 0 && !creandoEtiqueta && (
          <span className="text-xs text-muted-foreground italic">
            Sin etiquetas. Pulsa + para añadir.
          </span>
        )}
        {etiquetas.map((e) => (
          <EtiquetaItem
            key={e.id}
            etiqueta={e}
            editando={editandoEtiqueta === e.id}
            onStartEdit={() => setEditandoEtiqueta(e.id)}
            onEndEdit={() => setEditandoEtiqueta(null)}
            onChange={onChange}
          />
        ))}
        {creandoEtiqueta && (
          <EtiquetaCrearInline
            categoriaId={categoria.id}
            scope={categoria.scope}
            orden={etiquetas.length + 1}
            onDone={() => {
              setCreandoEtiqueta(false);
              onChange();
            }}
            onCancel={() => setCreandoEtiqueta(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Item de etiqueta (chip clicable → popover de edición)
// ─────────────────────────────────────────────────────────────────────────
function EtiquetaItem({
  etiqueta,
  editando,
  onStartEdit,
  onEndEdit,
  onChange,
}: {
  etiqueta: Etiqueta;
  editando: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onChange: () => void;
}) {
  const [nombre, setNombre] = useState(etiqueta.nombre);
  const [emoji, setEmoji] = useState(etiqueta.emoji ?? "");
  const [color, setColor] = useState(etiqueta.color);

  async function guardar() {
    const patch: Parameters<typeof updateEtiqueta>[1] = {};
    if (nombre.trim() && nombre !== etiqueta.nombre) patch.nombre = nombre;
    if (emoji !== (etiqueta.emoji ?? "")) patch.emoji = emoji || null;
    if (color !== etiqueta.color) patch.color = color;
    if (Object.keys(patch).length > 0) {
      const res = await updateEtiqueta(etiqueta.id, patch);
      if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
      else onChange();
    }
    onEndEdit();
  }

  async function toggleActivo(v: boolean) {
    const res = await updateEtiqueta(etiqueta.id, { activo: v });
    if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    else onChange();
  }

  async function borrar() {
    if (etiqueta.sistema) {
      toast.error("Etiqueta del sistema: desactívala en lugar de borrarla.");
      return;
    }
    if (!confirm(`¿Borrar la etiqueta "${etiqueta.nombre}"?`)) return;
    const res = await deleteEtiqueta(etiqueta.id);
    if (!res.ok) toast.error(res.error ?? "No se pudo borrar");
    else {
      toast.success("Etiqueta borrada");
      onChange();
    }
  }

  return (
    <Popover open={editando} onOpenChange={(o) => (o ? onStartEdit() : onEndEdit())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={!etiqueta.activo ? "opacity-40" : ""}
          title={etiqueta.activo ? "Editar etiqueta" : "Inactiva — pulsa para editar"}
        >
          <EtiquetaChip nombre={etiqueta.nombre} emoji={etiqueta.emoji} color={etiqueta.color} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">
            Editar etiqueta {etiqueta.sistema ? "(sistema)" : ""}
          </div>
          <div className="flex gap-1.5 items-center">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              placeholder="🎉"
              className="h-8 w-14 text-center"
            />
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-14 p-0.5 cursor-pointer"
            />
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-8 flex-1"
              onKeyDown={(e) => e.key === "Enter" && guardar()}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs">
              <Switch checked={etiqueta.activo} onCheckedChange={toggleActivo} />
              <span className="text-muted-foreground">
                {etiqueta.activo ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!etiqueta.sistema && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={borrar}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" className="h-7" onClick={guardar}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Inline para crear etiqueta nueva dentro de la categoría
// ─────────────────────────────────────────────────────────────────────────
function EtiquetaCrearInline({
  categoriaId,
  scope,
  orden,
  onDone,
  onCancel,
}: {
  categoriaId: string;
  scope: "reserva" | "cliente";
  orden: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [creando, setCreando] = useState(false);

  async function crear() {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setCreando(true);
    const res = await createEtiqueta({
      scope,
      categoriaId,
      nombre,
      emoji: emoji || null,
      color,
      orden,
    });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear");
      return;
    }
    onDone();
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-dashed px-1.5 py-1 bg-muted/30">
      <Input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        maxLength={4}
        placeholder="🎉"
        className="h-6 w-10 text-center text-xs"
      />
      <Input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-6 w-10 p-0.5 cursor-pointer"
      />
      <Input
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") crear();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Nombre"
        className="h-6 w-32 text-xs"
      />
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={crear} disabled={creando}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
