"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { toast } from "sonner";
import {
  CATEGORIA_CUESTIONARIO_LABEL,
  type CategoriaCuestionario,
} from "@/features/calidad/data/cuestionarios";
import {
  listPlantillas,
  crearPlantilla,
  updatePlantilla,
  deletePlantilla,
} from "@/features/calidad/cuestionarios/actions";
import type { PlantillaCuestionario } from "@/features/calidad/cuestionarios/types";

interface Props {
  onVolver: () => void;
}

export function PlantillasCuestionarioView({ onVolver }: Props) {
  const [plantillas, setPlantillas] = useState<PlantillaCuestionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<PlantillaCuestionario | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    setLoading(true);
    listPlantillas().then((data) => {
      setPlantillas(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return plantillas;
    return plantillas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.descripcion.toLowerCase().includes(q),
    );
  }, [plantillas, busqueda]);

  function abrirNueva() {
    setEditando(null);
    setDialogOpen(true);
  }

  function abrirEdicion(p: PlantillaCuestionario) {
    setEditando(p);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar plantilla"
        onNuevo={abrirNueva}
        textoNuevo="Nueva plantilla"
        extraDerecha={
          <Button
            variant="outline"
            size="sm"
            onClick={onVolver}
            className="h-9 gap-2"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Volver a Cuestionarios
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey="calidad-cuestionarios-plantillas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <TableColumnHeader label="Nombre" />
                <TableColumnHeader label="Categoría" />
                <TableColumnHeader label="Preguntas" />
                <TableColumnHeader label="Duración" />
                <TableColumnHeader label="Estado" />
              </tr>
            </thead>
            <tbody>
              {loading && plantillas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10">
                    <LoadingSpinner />
                  </td>
                </tr>
              )}
              {!loading && filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">
                    {plantillas.length === 0
                      ? "Aún no hay plantillas. Crea la primera con + Nueva plantilla."
                      : "Ninguna plantilla coincide con la búsqueda."}
                  </td>
                </tr>
              )}
              {filtradas.map((p) => {
                const totalPreguntas = p.bloques.reduce(
                  (s, b) => s + b.preguntas.length,
                  0,
                );
                return (
                  <tr
                    key={p.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => abrirEdicion(p)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.nombre}</div>
                      {p.descripcion && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {p.descripcion}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {CATEGORIA_CUESTIONARIO_LABEL[p.categoria]}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{totalPreguntas}</td>
                    <td className="px-3 py-2.5 tabular-nums">{p.duracionMinutos} min</td>
                    <td className="px-3 py-2.5">
                      {p.archivada ? (
                        <Badge variant="outline" className="text-[10px]">Archivada</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-200">
                          Activa
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      <div className="text-xs text-muted-foreground text-right">
        {filtradas.length} de {plantillas.length}{" "}
        {plantillas.length === 1 ? "plantilla" : "plantillas"}
      </div>

      <PlantillaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plantilla={editando}
        onGuardada={() => startTransition(refresh)}
      />
    </div>
  );
}

// ─── Dialog de crear/editar plantilla ─────────────────────────

interface PlantillaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantilla: PlantillaCuestionario | null;
  onGuardada: () => void;
}

function PlantillaDialog({ open, onOpenChange, plantilla, onGuardada }: PlantillaDialogProps) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<CategoriaCuestionario>("evaluacion");
  const [duracionMinutos, setDuracionMinutos] = useState(15);
  const [notaCorte, setNotaCorte] = useState(70);
  const [archivada, setArchivada] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (plantilla) {
      setNombre(plantilla.nombre);
      setDescripcion(plantilla.descripcion);
      setCategoria(plantilla.categoria);
      setDuracionMinutos(plantilla.duracionMinutos);
      setNotaCorte(plantilla.notaCorte);
      setArchivada(plantilla.archivada);
    } else {
      setNombre("");
      setDescripcion("");
      setCategoria("evaluacion");
      setDuracionMinutos(15);
      setNotaCorte(70);
      setArchivada(false);
    }
  }, [open, plantilla]);

  async function onSubmit() {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSubmitting(true);
    if (plantilla) {
      const res = await updatePlantilla({
        id: plantilla.id,
        nombre,
        descripcion,
        categoria,
        duracionMinutos,
        notaCorte,
        archivada,
      });
      setSubmitting(false);
      if (!res.ok) return toast.error(res.error);
      toast.success("Plantilla actualizada");
    } else {
      const res = await crearPlantilla({ nombre, descripcion, categoria });
      setSubmitting(false);
      if (!res.ok) return toast.error(res.error);
      toast.success("Plantilla creada");
    }
    onOpenChange(false);
    onGuardada();
  }

  async function onDelete() {
    if (!plantilla) return;
    if (!confirm("¿Eliminar esta plantilla? No se puede deshacer.")) return;
    setSubmitting(true);
    const res = await deletePlantilla(plantilla.id);
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Plantilla eliminada");
    onOpenChange(false);
    onGuardada();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plantilla ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          {!plantilla && (
            <DialogDescription>
              Crea la plantilla con su info básica. Las preguntas se cargan luego en la edición.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="p. ej. Cuestionario Semestral General"
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Breve descripción del cuestionario"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaCuestionario)}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              >
                {(Object.keys(CATEGORIA_CUESTIONARIO_LABEL) as CategoriaCuestionario[]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {CATEGORIA_CUESTIONARIO_LABEL[k]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Duración (min)</Label>
              <Input
                type="number"
                min={1}
                max={240}
                value={duracionMinutos}
                onChange={(e) => setDuracionMinutos(Number(e.target.value) || 15)}
              />
            </div>
          </div>

          {plantilla && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nota de corte (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={notaCorte}
                    onChange={(e) => setNotaCorte(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2 flex flex-col">
                  <Label>Estado</Label>
                  <label className="flex items-center gap-2 text-sm h-9">
                    <input
                      type="checkbox"
                      checked={archivada}
                      onChange={(e) => setArchivada(e.target.checked)}
                    />
                    Archivada
                  </label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Las preguntas (bloques) se editan en una iteración futura. Por ahora se mantienen
                las que ya tiene la plantilla.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between">
          {plantilla ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={submitting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {plantilla ? "Guardar" : "Crear"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
