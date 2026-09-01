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
import { Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { EtiquetaChip } from "./EtiquetaChip";
import { EmojiPicker } from "./EmojiPicker";
import {
  createEtiqueta,
  deleteEtiqueta,
  updateEtiqueta,
  type Etiqueta,
  type EtiquetaCategoria,
} from "@/features/sala/actions/sala-etiquetas-actions";

interface Props {
  /** `null` = tarjeta de las etiquetas que se quedaron sin grupo. */
  categoria: EtiquetaCategoria | null;
  /** Solo se usa cuando `categoria` es null, para saber a qué scope pertenecen. */
  scope?: "reserva" | "cliente";
  etiquetas: Etiqueta[];
  /** Grupos del mismo scope, para poder mover una etiqueta de grupo. */
  categorias: EtiquetaCategoria[];
  onChange: () => void;
}

export function CategoriaEtiquetasCard({
  categoria,
  scope,
  etiquetas,
  categorias,
  onChange,
}: Props) {
  const [creandoEtiqueta, setCreandoEtiqueta] = useState(false);
  const [editandoEtiqueta, setEditandoEtiqueta] = useState<string | null>(null);
  const scopeEfectivo = categoria?.scope ?? scope ?? "reserva";

  return (
    <div className="rounded-md border bg-card">
      {/* Header de categoría — el grupo no se renombra ni se borra: es la
          clasificación canónica del software. Solo se añaden etiquetas. */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 flex-1">
          <h5
            className={
              categoria
                ? "text-sm font-semibold text-primary"
                : "text-sm font-semibold text-muted-foreground"
            }
          >
            {categoria?.nombre ?? "Sin grupo"}
          </h5>
          {!categoria && (
            <span className="text-[10px] text-muted-foreground">
              asigna un grupo desde cada etiqueta
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {categoria && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Añadir etiqueta"
              onClick={() => setCreandoEtiqueta(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
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
            categorias={categorias}
            editando={editandoEtiqueta === e.id}
            onStartEdit={() => setEditandoEtiqueta(e.id)}
            onEndEdit={() => setEditandoEtiqueta(null)}
            onChange={onChange}
          />
        ))}
        {creandoEtiqueta && categoria && (
          <EtiquetaCrearInline
            categoriaId={categoria.id}
            scope={scopeEfectivo}
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
  categorias,
  editando,
  onStartEdit,
  onEndEdit,
  onChange,
}: {
  etiqueta: Etiqueta;
  categorias: EtiquetaCategoria[];
  editando: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onChange: () => void;
}) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const [nombre, setNombre] = useState(etiqueta.nombre);
  const [emoji, setEmoji] = useState(etiqueta.emoji ?? "");
  const [color, setColor] = useState(etiqueta.color);
  const [categoriaId, setCategoriaId] = useState(etiqueta.categoriaId ?? "");

  async function guardar() {
    const patch: Parameters<typeof updateEtiqueta>[1] = {};
    if (nombre.trim() && nombre !== etiqueta.nombre) patch.nombre = nombre;
    if (emoji !== (etiqueta.emoji ?? "")) patch.emoji = emoji || null;
    if (color !== etiqueta.color) patch.color = color;
    if (categoriaId !== (etiqueta.categoriaId ?? "")) {
      patch.categoriaId = categoriaId || null;
    }
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
    const ok = await confirmDelete({
      title: "Borrar etiqueta",
      description: `¿Borrar la etiqueta "${etiqueta.nombre}"?`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const res = await deleteEtiqueta(etiqueta.id);
    if (!res.ok) toast.error(res.error ?? "No se pudo borrar");
    else {
      toast.success("Etiqueta borrada");
      onChange();
    }
  }

  return (
    <>
      {confirmDeleteDialog}
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
            Editar etiqueta
          </div>
          <div className="flex gap-1.5 items-center">
            <EmojiPicker value={emoji} onChange={setEmoji} />
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
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Grupo</span>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">— Sin grupo —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs">
              <Switch checked={etiqueta.activo} onCheckedChange={toggleActivo} />
              <span className="text-muted-foreground">
                {etiqueta.activo ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Borrar etiqueta"
                onClick={borrar}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-7" onClick={guardar}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
      </Popover>
    </>
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
      <EmojiPicker value={emoji} onChange={setEmoji} size="sm" />
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
