"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GripVertical, Pencil, Trash2, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  listEtiquetas,
  createEtiqueta,
  updateEtiqueta,
  deleteEtiqueta,
  reorderEtiquetas,
  type EtiquetaRow,
  type EtiquetaTipo,
} from "../actions/etiquetas-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const TABS: { label: string; tipo: EtiquetaTipo }[] = [
  { label: "Categorías",   tipo: "CATEGORIA" },
  { label: "Alertas",      tipo: "ALERTA" },
  { label: "Ingresos",     tipo: "INGRESO" },
  { label: "Departamentos",tipo: "DEPARTAMENTO" },
  { label: "Empleados",    tipo: "EMPLEADO" },
  { label: "Informes",     tipo: "INFORME" },
  { label: "Estadísticas", tipo: "ESTADISTICA" },
  { label: "Patrimonio",   tipo: "PATRIMONIO" },
];

const DEFAULT_COLOR = "#6366f1";

type Arbol = { categoria: EtiquetaRow; hijos: EtiquetaRow[] }[];

export function EtiquetasView() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [tipoActivo, setTipoActivo] = useState<EtiquetaTipo>("CATEGORIA");
  const [filas, setFilas] = useState<EtiquetaRow[]>([]);
  const [loading, setLoading] = useState(true);
  useGlobalLoadingSync(loading);
  const [showConfig, setShowConfig] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const [dialogCrear, setDialogCrear] = useState<{
    open: boolean;
    tipo: "categoria" | "etiqueta";
    parentId: string | null;
    nombre: string;
    emoji: string;
  }>({ open: false, tipo: "categoria", parentId: null, nombre: "", emoji: "🏷️" });

  const [dialogEditar, setDialogEditar] = useState<{
    open: boolean;
    id: string | null;
    nombre: string;
    emoji: string;
    color: string;
    esCategoria: boolean;
  }>({ open: false, id: null, nombre: "", emoji: "", color: DEFAULT_COLOR, esCategoria: false });

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEtiquetas();
      if (res.ok) {
        setFilas(res.data);
      } else {
        toast.error("No se pudieron cargar las etiquetas");
      }
    } catch {
      toast.error("Error de conexión al cargar etiquetas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, empresaActual?.id]);

  const filasTab = useMemo(
    () => filas.filter((f) => f.tipo === tipoActivo),
    [filas, tipoActivo],
  );

  const arbol: Arbol = useMemo(() => {
    const categorias = filasTab
      .filter((f) => f.parent_id === null)
      .sort((a, b) => a.orden - b.orden);
    const hijosByParent = new Map<string, EtiquetaRow[]>();
    for (const f of filasTab) {
      if (f.parent_id) {
        const arr = hijosByParent.get(f.parent_id) ?? [];
        arr.push(f);
        hijosByParent.set(f.parent_id, arr);
      }
    }
    for (const arr of hijosByParent.values()) {
      arr.sort((a, b) => a.orden - b.orden);
    }
    return categorias.map((c) => ({ categoria: c, hijos: hijosByParent.get(c.id) ?? [] }));
  }, [filasTab, tipoActivo]);

  const arbolFiltrado: Arbol = useMemo(() => {
    if (!busqueda.trim()) return arbol;
    const q = busqueda.toLowerCase();
    return arbol
      .map(({ categoria, hijos }) => ({
        categoria,
        hijos: hijos.filter((h) => h.nombre.toLowerCase().includes(q)),
      }))
      .filter(({ categoria, hijos }) => categoria.nombre.toLowerCase().includes(q) || hijos.length > 0);
  }, [arbol, busqueda]);

  const etiquetaActiva = activeDragId ? filas.find((f) => f.id === activeDragId) : null;

  function abrirCrearCategoria() {
    setDialogCrear({ open: true, tipo: "categoria", parentId: null, nombre: "", emoji: "🏷️" });
  }

  function abrirCrearSubEtiqueta(parentId: string) {
    setDialogCrear({ open: true, tipo: "etiqueta", parentId, nombre: "", emoji: "" });
  }

  async function handleCrear() {
    const nombre = dialogCrear.nombre.trim();
    if (!nombre) {
      toast.error("Pon un nombre");
      return;
    }
    const res = await createEtiqueta({
      nombre,
      parent_id: dialogCrear.tipo === "etiqueta" ? dialogCrear.parentId : null,
      emoji: dialogCrear.tipo === "categoria" ? dialogCrear.emoji || null : null,
      tipo: tipoActivo,
    });
    if (res.ok) {
      toast.success(dialogCrear.tipo === "categoria" ? "Categoría creada" : "Etiqueta creada");
      setDialogCrear((d) => ({ ...d, open: false }));
      cargar();
    } else {
      toast.error(res.error ?? "No se pudo crear");
    }
  }

  function abrirEditar(row: EtiquetaRow) {
    setDialogEditar({
      open: true,
      id: row.id,
      nombre: row.nombre,
      emoji: row.emoji ?? "",
      color: row.color ?? DEFAULT_COLOR,
      esCategoria: row.parent_id === null,
    });
  }

  async function handleEditar() {
    if (!dialogEditar.id) return;
    const nombre = dialogEditar.nombre.trim();
    if (!nombre) {
      toast.error("Pon un nombre");
      return;
    }
    const res = await updateEtiqueta(dialogEditar.id, {
      nombre,
      emoji: dialogEditar.esCategoria ? dialogEditar.emoji || null : undefined,
      color: dialogEditar.esCategoria ? dialogEditar.color || null : undefined,
    });
    if (res.ok) {
      toast.success("Guardado");
      setDialogEditar((d) => ({ ...d, open: false }));
      cargar();
    } else {
      toast.error(res.error ?? "No se pudo guardar");
    }
  }

  async function handleBorrar(row: EtiquetaRow) {
    const esCategoria = row.parent_id === null;
    const ok = await confirmDelete({
      title: esCategoria ? "Borrar categoría" : "Borrar etiqueta",
      description: esCategoria
        ? `¿Borrar la categoría "${row.nombre}" y todas sus etiquetas?`
        : `¿Borrar la etiqueta "${row.nombre}"?`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const res = await deleteEtiqueta(row.id);
    if (res.ok) {
      toast.success("Borrada");
      cargar();
    } else {
      toast.error(res.error ?? "No se pudo borrar");
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over) return;
    const draggedId = String(active.id);
    const overId = String(over.id);
    if (draggedId === overId) return;

    const dragged = filas.find((f) => f.id === draggedId);
    if (!dragged || dragged.parent_id === null) return;

    let nuevoParentId: string;
    let insertIdx: number;

    if (overId.startsWith("cat:")) {
      nuevoParentId = overId.slice(4);
      const siblings = filas
        .filter((f) => f.parent_id === nuevoParentId && f.id !== draggedId)
        .sort((a, b) => a.orden - b.orden);
      insertIdx = siblings.length;
    } else {
      const target = filas.find((f) => f.id === overId);
      if (!target || target.parent_id === null) return;
      nuevoParentId = target.parent_id;
      const siblings = filas
        .filter((f) => f.parent_id === nuevoParentId && f.id !== draggedId)
        .sort((a, b) => a.orden - b.orden);
      insertIdx = siblings.findIndex((s) => s.id === overId);
      if (insertIdx === -1) insertIdx = siblings.length;
    }

    const siblings = filas
      .filter((f) => f.parent_id === nuevoParentId && f.id !== draggedId)
      .sort((a, b) => a.orden - b.orden);
    const newList = [...siblings];
    newList.splice(insertIdx, 0, { ...dragged, parent_id: nuevoParentId });

    const batch = newList.map((s, idx) => ({
      id: s.id,
      orden: idx,
      parent_id: nuevoParentId,
    }));

    setFilas((prev) =>
      prev.map((f) => {
        const updated = batch.find((b) => b.id === f.id);
        return updated ? { ...f, parent_id: updated.parent_id, orden: updated.orden } : f;
      }),
    );

    const res = await reorderEtiquetas(batch);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo reordenar");
      cargar();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b px-6 pt-4 flex items-center gap-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.tipo}
            onClick={() => setTipoActivo(t.tipo)}
            className={cn(
              "pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              tipoActivo === t.tipo
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-[1100px] mx-auto w-full">
        <div className="mb-6">
          <SubmoduleToolbar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            placeholderBusqueda="Buscar"
            onNuevo={abrirCrearCategoria}
            extraDerecha={
              <Button
                size="icon"
                variant={showConfig ? "default" : "outline"}
                className="h-9 w-9"
                onClick={() => setShowConfig((v) => !v)}
                title="Configuración"
                aria-label="Configuración"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            }
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando…
          </div>
        ) : arbolFiltrado.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No hay etiquetas todavía. Pulsa <span className="font-semibold">+ Nuevo</span> para crear la primera categoría.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="space-y-2">
              {arbolFiltrado.map(({ categoria, hijos }) => (
                <CategoriaBloque
                  key={categoria.id}
                  categoria={categoria}
                  hijos={hijos}
                  onNuevaSub={() => abrirCrearSubEtiqueta(categoria.id)}
                  onEditar={abrirEditar}
                  onBorrar={handleBorrar}
                />
              ))}
            </div>
            <DragOverlay>
              {etiquetaActiva ? (
                <SubEtiquetaChip nombre={etiquetaActiva.nombre} color={etiquetaActiva.color ?? DEFAULT_COLOR} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Dialog crear */}
      <Dialog open={dialogCrear.open} onOpenChange={(open) => setDialogCrear((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogCrear.tipo === "categoria" ? "Nueva categoría" : "Nueva etiqueta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={dialogCrear.tipo}
                onValueChange={(v) =>
                  setDialogCrear((d) => ({ ...d, tipo: v as "categoria" | "etiqueta" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="categoria">Categoría</SelectItem>
                  <SelectItem value="etiqueta">Etiqueta (dentro de categoría)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dialogCrear.tipo === "etiqueta" && (
              <div>
                <Label>Categoría padre</Label>
                <Select
                  value={dialogCrear.parentId ?? ""}
                  onValueChange={(v) => setDialogCrear((d) => ({ ...d, parentId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {arbol.map(({ categoria }) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        {categoria.emoji ?? "🏷️"} {categoria.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {dialogCrear.tipo === "categoria" && (
              <div>
                <Label>Emoji</Label>
                <Input
                  value={dialogCrear.emoji}
                  onChange={(e) => setDialogCrear((d) => ({ ...d, emoji: e.target.value }))}
                  maxLength={4}
                  placeholder="🏷️"
                />
              </div>
            )}

            <div>
              <Label>Nombre</Label>
              <Input
                value={dialogCrear.nombre}
                onChange={(e) => setDialogCrear((d) => ({ ...d, nombre: e.target.value }))}
                placeholder={dialogCrear.tipo === "categoria" ? "Marketing" : "Facebook Ads"}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogCrear((d) => ({ ...d, open: false }))}>
              Cancelar
            </Button>
            <Button onClick={handleCrear}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar */}
      <Dialog open={dialogEditar.open} onOpenChange={(open) => setDialogEditar((d) => ({ ...d, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogEditar.esCategoria ? "Editar categoría" : "Editar etiqueta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {dialogEditar.esCategoria && (
              <>
                <div>
                  <Label>Emoji</Label>
                  <Input
                    value={dialogEditar.emoji}
                    onChange={(e) => setDialogEditar((d) => ({ ...d, emoji: e.target.value }))}
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label>Color (se aplica también a sus sub-etiquetas)</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={dialogEditar.color}
                      onChange={(e) => setDialogEditar((d) => ({ ...d, color: e.target.value }))}
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={dialogEditar.color}
                      onChange={(e) => setDialogEditar((d) => ({ ...d, color: e.target.value }))}
                      placeholder="#16a34a"
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <Label>Nombre</Label>
              <Input
                value={dialogEditar.nombre}
                onChange={(e) => setDialogEditar((d) => ({ ...d, nombre: e.target.value }))}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEditar((d) => ({ ...d, open: false }))}>
              Cancelar
            </Button>
            <Button onClick={handleEditar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDeleteDialog}
    </div>
  );
}

function CategoriaBloque({
  categoria,
  hijos,
  onNuevaSub,
  onEditar,
  onBorrar,
}: {
  categoria: EtiquetaRow;
  hijos: EtiquetaRow[];
  onNuevaSub: () => void;
  onEditar: (row: EtiquetaRow) => void;
  onBorrar: (row: EtiquetaRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cat:${categoria.id}` });
  const color = categoria.color ?? DEFAULT_COLOR;

  return (
    <div ref={setNodeRef}>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-4 bg-muted/30 rounded-xl border transition-colors",
          isOver ? "bg-muted/60" : "hover:bg-muted/40",
        )}
        style={isOver ? { borderColor: color, backgroundColor: `${color}10` } : undefined}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <span className="text-2xl shrink-0">{categoria.emoji ?? "🏷️"}</span>
        <span className="font-bold flex-1" style={{ color }}>
          {categoria.nombre}
        </span>
        <Button
          size="icon"
          className="h-8 w-8 rounded-full border"
          style={{ backgroundColor: `${color}1A`, borderColor: `${color}33`, color }}
          onClick={onNuevaSub}
          title="Añadir etiqueta"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditar(categoria)} title="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onBorrar(categoria)} title="Borrar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={hijos.map((h) => h.id)} strategy={verticalListSortingStrategy}>
        {hijos.map((h) => (
          <SubEtiquetaFila key={h.id} row={h} onEditar={onEditar} onBorrar={onBorrar} />
        ))}
      </SortableContext>
    </div>
  );
}

function SubEtiquetaFila({
  row,
  onEditar,
  onBorrar,
}: {
  row: EtiquetaRow;
  onEditar: (row: EtiquetaRow) => void;
  onBorrar: (row: EtiquetaRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const color = row.color ?? DEFAULT_COLOR;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 ml-4 border-b last:border-b-0 hover:bg-muted/20 transition-colors",
        isDragging && "opacity-30",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1"
        aria-label="Arrastrar para reordenar o mover de categoría"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </button>
      <SubEtiquetaChip nombre={row.nombre} color={color} />
      <div className="flex-1" />
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditar(row)} title="Editar">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onBorrar(row)} title="Borrar">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SubEtiquetaChip({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {nombre}
    </span>
  );
}
