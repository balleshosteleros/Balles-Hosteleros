"use client";

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff, GripVertical, Trash2 } from "lucide-react";
import { useEditorStore } from "../../../hooks/useEditorStore";
import { Button } from "@/components/ui/button";
import { getCatalogo } from "../../../data/bloques-catalogo";
import type { Bloque } from "../../../types";
import { BloqueRenderer } from "./BloqueRenderer";

function SortableBloque({ bloque }: { bloque: Bloque }) {
  const seleccionadoId = useEditorStore((s) => s.seleccionadoId);
  const seleccionar = useEditorStore((s) => s.seleccionar);
  const borrarBloque = useEditorStore((s) => s.borrarBloque);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bloque.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const catalogo = getCatalogo(bloque.tipo);
  const Icon = catalogo.icon;
  const seleccionado = seleccionadoId === bloque.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border bg-card transition ${
        seleccionado ? "border-primary ring-2 ring-primary/30" : "border-muted"
      } ${bloque.visible ? "" : "opacity-50"}`}
      onClick={() => seleccionar(bloque.id)}
    >
      {/* Header del bloque */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          aria-label="Arrastrar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wide">{catalogo.label}</span>
        <span className="text-xs text-muted-foreground">#{bloque.orden + 1}</span>
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={bloque.visible ? "Ocultar bloque" : "Mostrar bloque"}
            onClick={(e) => {
              e.stopPropagation();
              toggleVisible(bloque.id);
            }}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600 hover:text-red-700"
            title="Borrar bloque"
            onClick={(e) => {
              e.stopPropagation();
              borrarBloque(bloque.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview compacta del bloque */}
      <div className="p-3">
        <BloqueRenderer bloque={bloque} modo="canvas" />
      </div>
    </div>
  );
}

export function Canvas() {
  const bloques = useEditorStore((s) => s.bloques);
  const reordenar = useEditorStore((s) => s.reordenar);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = bloques.findIndex((b) => b.id === active.id);
    const newIndex = bloques.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const nuevos = arrayMove(bloques, oldIndex, newIndex);
    reordenar(nuevos.map((b) => b.id));
  };

  return (
    <main className="flex-1 overflow-y-auto bg-muted/20">
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-3">
        {bloques.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Añade bloques desde la biblioteca de la izquierda
            </p>
          </div>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={bloques.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {bloques.map((b) => (
              <SortableBloque key={b.id} bloque={b} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </main>
  );
}
