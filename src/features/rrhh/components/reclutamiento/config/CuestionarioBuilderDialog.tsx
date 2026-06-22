"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Copy, Trash2, GripVertical, Loader2, X, Lock } from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MAX_PREGUNTAS_CUESTIONARIO,
  MAX_OPCIONES_PREGUNTA,
  preguntaVacia,
  nuevoId,
  type PreguntaCuestionario,
} from "@/features/rrhh/data/cuestionario-vacante";
import {
  getCuestionarioVacante,
  createCuestionarioVacante,
  updateCuestionarioVacante,
} from "@/features/rrhh/actions/cuestionarios-vacante-actions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = crear nuevo. */
  cuestionarioId: string | null;
  onSaved?: () => void;
}

export function CuestionarioBuilderDialog({ open, onOpenChange, cuestionarioId, onSaved }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [preguntas, setPreguntas] = useState<PreguntaCuestionario[]>([]);
  const [usado, setUsado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (!open) return;
    if (!cuestionarioId) {
      setNombre("");
      setDescripcion("");
      setPreguntas([preguntaVacia()]);
      setUsado(false);
      return;
    }
    setLoading(true);
    void getCuestionarioVacante(cuestionarioId).then((res) => {
      if (res.data) {
        setNombre(res.data.nombre);
        setDescripcion(res.data.descripcion ?? "");
        setPreguntas(res.data.preguntas.length ? res.data.preguntas : [preguntaVacia()]);
        setUsado(!!res.data.usado);
      }
      setLoading(false);
    });
  }, [open, cuestionarioId]);

  const readOnly = usado;

  function setPregunta(id: string, patch: Partial<PreguntaCuestionario>) {
    setPreguntas((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addPregunta() {
    if (preguntas.length >= MAX_PREGUNTAS_CUESTIONARIO) {
      toast.error(`Máximo ${MAX_PREGUNTAS_CUESTIONARIO} preguntas`);
      return;
    }
    setPreguntas((prev) => [...prev, preguntaVacia()]);
  }

  function duplicarPregunta(id: string) {
    if (preguntas.length >= MAX_PREGUNTAS_CUESTIONARIO) {
      toast.error(`Máximo ${MAX_PREGUNTAS_CUESTIONARIO} preguntas`);
      return;
    }
    setPreguntas((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0) return prev;
      const orig = prev[i];
      const copia: PreguntaCuestionario = {
        ...orig,
        id: nuevoId("p"),
        opciones: orig.opciones.map((o) => ({ ...o, id: nuevoId("o") })),
      };
      return [...prev.slice(0, i + 1), copia, ...prev.slice(i + 1)];
    });
  }

  function eliminarPregunta(id: string) {
    setPreguntas((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  }

  function addOpcion(pid: string) {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        if (p.opciones.length >= MAX_OPCIONES_PREGUNTA) {
          toast.error(`Máximo ${MAX_OPCIONES_PREGUNTA} respuestas por pregunta`);
          return p;
        }
        return { ...p, opciones: [...p.opciones, { id: nuevoId("o"), texto: "", correcta: false }] };
      }),
    );
  }

  function setOpcionTexto(pid: string, oid: string, texto: string) {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, opciones: p.opciones.map((o) => (o.id === oid ? { ...o, texto } : o)) }
          : p,
      ),
    );
  }

  function marcarCorrecta(pid: string, oid: string) {
    // Una sola respuesta correcta por pregunta.
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, opciones: p.opciones.map((o) => ({ ...o, correcta: o.id === oid })) }
          : p,
      ),
    );
  }

  function eliminarOpcion(pid: string, oid: string) {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.id !== pid || p.opciones.length <= 2) return p;
        const restantes = p.opciones.filter((o) => o.id !== oid);
        // Si se eliminó la opción correcta, marca la primera restante como correcta.
        if (!restantes.some((o) => o.correcta) && restantes.length > 0) {
          restantes[0] = { ...restantes[0], correcta: true };
        }
        return { ...p, opciones: restantes };
      }),
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPreguntas((prev) => {
      const oldI = prev.findIndex((p) => p.id === active.id);
      const newI = prev.findIndex((p) => p.id === over.id);
      if (oldI < 0 || newI < 0) return prev;
      return arrayMove(prev, oldI, newI);
    });
  }

  function guardar() {
    startTransition(async () => {
      // Todas las preguntas son obligatorias (la nota se calcula sobre el total).
      const preguntasNorm = preguntas.map((p) => ({ ...p, obligatoria: true }));
      const payload = { nombre, descripcion: descripcion || null, preguntas: preguntasNorm };
      const res = cuestionarioId
        ? await updateCuestionarioVacante(cuestionarioId, payload)
        : await createCuestionarioVacante(payload);
      if (res.ok) {
        toast.success(cuestionarioId ? "Cuestionario actualizado" : "Cuestionario creado");
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(("error" in res && res.error) || "Error al guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{cuestionarioId ? "Editar cuestionario" : "Nuevo cuestionario"}</DialogTitle>
          <DialogDescription>
            Elección múltiple con una respuesta correcta por pregunta. La nota del candidato será aciertos ÷ nº de preguntas × 10. Máximo {MAX_PREGUNTAS_CUESTIONARIO} preguntas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {readOnly && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                Este cuestionario ya lo han respondido candidatos, por lo que no se puede editar (rompería sus notas). Duplícalo para crear una versión nueva.
              </div>
            )}

            {/* Cabecera */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre del cuestionario *</Label>
                <Input
                  value={nombre}
                  disabled={readOnly}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Evaluación de actitud y compromiso personal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea
                  value={descripcion}
                  disabled={readOnly}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  placeholder="Texto introductorio que verá el candidato…"
                />
              </div>
            </div>

            {/* Preguntas */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={preguntas.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {preguntas.map((p, idx) => (
                    <PreguntaCard
                      key={p.id}
                      pregunta={p}
                      indice={idx}
                      readOnly={readOnly}
                      onPatch={(patch) => setPregunta(p.id, patch)}
                      onDuplicar={() => duplicarPregunta(p.id)}
                      onEliminar={() => eliminarPregunta(p.id)}
                      puedeEliminar={preguntas.length > 1}
                      onAddOpcion={() => addOpcion(p.id)}
                      onOpcionTexto={(oid, t) => setOpcionTexto(p.id, oid, t)}
                      onMarcarCorrecta={(oid) => marcarCorrecta(p.id, oid)}
                      onEliminarOpcion={(oid) => eliminarOpcion(p.id, oid)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {!readOnly && (
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={addPregunta} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Añadir pregunta
                </Button>
                <span className="text-xs text-muted-foreground">
                  {preguntas.length} / {MAX_PREGUNTAS_CUESTIONARIO} preguntas
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {readOnly ? "Cerrar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button onClick={guardar} disabled={pending || loading}>
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {cuestionarioId ? "Guardar cambios" : "Crear cuestionario"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tarjeta de pregunta ────────────────────────────────────────
function PreguntaCard({
  pregunta, indice, readOnly,
  onPatch, onDuplicar, onEliminar, puedeEliminar,
  onAddOpcion, onOpcionTexto, onMarcarCorrecta, onEliminarOpcion,
}: {
  pregunta: PreguntaCuestionario;
  indice: number;
  readOnly: boolean;
  onPatch: (patch: Partial<PreguntaCuestionario>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
  puedeEliminar: boolean;
  onAddOpcion: () => void;
  onOpcionTexto: (oid: string, texto: string) => void;
  onMarcarCorrecta: (oid: string) => void;
  onEliminarOpcion: (oid: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pregunta.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border border-border bg-card ${isDragging ? "opacity-80 shadow-lg" : ""}`}>
      {/* Cabecera de la pregunta */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {!readOnly && (
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            aria-label="Reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-semibold text-foreground">Pregunta {indice + 1}</span>
        <span className="text-[10px] font-medium text-muted-foreground rounded bg-muted px-1.5 py-0.5">
          Obligatoria
        </span>
        <div className="ml-auto flex items-center gap-3">
          {!readOnly && (
            <>
              <button type="button" onClick={onDuplicar} className="text-muted-foreground hover:text-foreground" title="Duplicar">
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onEliminar}
                disabled={!puedeEliminar}
                className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Título + tipo */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={pregunta.titulo}
              disabled={readOnly}
              onChange={(e) => onPatch({ titulo: e.target.value })}
              placeholder="Escribe la pregunta…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={pregunta.tipo} disabled>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="eleccion_multiple">Elección múltiple</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Opciones */}
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-semibold text-foreground">Opciones de respuesta</p>
            <p className="text-[11px] text-muted-foreground">
              Marca cuál es la respuesta correcta (obligatorio, una por pregunta).
            </p>
          </div>
          {pregunta.opciones.map((o, i) => (
            <div key={o.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Opción {i + 1}</Label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Correcta
                  <Switch
                    checked={o.correcta}
                    disabled={readOnly}
                    onCheckedChange={() => onMarcarCorrecta(o.id)}
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={o.texto}
                  disabled={readOnly}
                  onChange={(e) => onOpcionTexto(o.id, e.target.value)}
                  placeholder={`Opción ${i + 1}`}
                  className={o.correcta ? "border-emerald-300 focus-visible:ring-emerald-200" : ""}
                />
                {!readOnly && pregunta.opciones.length > 2 && (
                  <button
                    type="button"
                    onClick={() => onEliminarOpcion(o.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    title="Quitar opción"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {!readOnly && pregunta.opciones.length < MAX_OPCIONES_PREGUNTA && (
            <button
              type="button"
              onClick={onAddOpcion}
              className="text-xs text-primary hover:underline"
            >
              + Añadir más opciones
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
