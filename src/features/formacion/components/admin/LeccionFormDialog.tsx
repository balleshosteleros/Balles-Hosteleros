"use client";

// Diálogo de alta / edición de lección. Permite gestionar la lista de
// recursos descargables (PDF, enlaces, imágenes...).

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormacionStore } from "../../store/use-formacion-store";
import type { Leccion, RecursoLeccion } from "../../types";

type Mode =
  | { mode: "new"; seccionId: string }
  | { mode: "edit"; leccion: Leccion };

interface Props {
  cursoId: string;
  mode: Mode;
  onClose: () => void;
}

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function LeccionFormDialog({ cursoId, mode, onClose }: Props) {
  const addLeccion = useFormacionStore((s) => s.addLeccion);
  const updateLeccion = useFormacionStore((s) => s.updateLeccion);
  const lecciones = useFormacionStore((s) => s.lecciones);

  const editing = mode.mode === "edit" ? mode.leccion : null;
  const seccionId = editing?.seccionId ?? (mode as { seccionId: string }).seccionId;
  const today = new Date().toISOString().slice(0, 10);

  const [titulo, setTitulo] = useState(editing?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? "");
  const [url, setUrl] = useState(
    editing?.url ??
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  );
  const [duracionMin, setDuracionMin] = useState<number>(
    editing?.duracionMin ?? 5,
  );
  const [fechaSubida, setFechaSubida] = useState(editing?.fechaSubida ?? today);
  const [recursos, setRecursos] = useState<RecursoLeccion[]>(
    editing?.recursos ?? [],
  );

  function añadirRecurso() {
    setRecursos((curr) => [
      ...curr,
      { id: genId("r"), titulo: "", url: "", tipo: "pdf" },
    ]);
  }
  function patchRecurso(id: string, patch: Partial<RecursoLeccion>) {
    setRecursos((curr) =>
      curr.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }
  function quitarRecurso(id: string) {
    setRecursos((curr) => curr.filter((r) => r.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !url.trim()) return;

    const recursosLimpios = recursos
      .map((r) => ({ ...r, titulo: r.titulo.trim(), url: r.url.trim() }))
      .filter((r) => r.titulo && r.url);

    if (editing) {
      updateLeccion(editing.id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        url: url.trim(),
        duracionMin: Math.max(1, Number(duracionMin) || 1),
        fechaSubida,
        recursos: recursosLimpios,
      });
    } else {
      const ordenSiguiente =
        lecciones.filter((l) => l.seccionId === seccionId).length + 1;
      addLeccion({
        cursoId,
        seccionId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        url: url.trim(),
        duracionMin: Math.max(1, Number(duracionMin) || 1),
        orden: ordenSiguiente,
        fechaSubida,
        recursos: recursosLimpios,
      });
    }

    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar lección" : "Nueva lección"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="lec-tit">Título</Label>
            <Input
              id="lec-tit"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              placeholder="Ej: Cómo tomar comanda en TPV"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lec-desc">Descripción</Label>
            <Textarea
              id="lec-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Qué aprende el empleado en este vídeo."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lec-url">URL del vídeo</Label>
            <Input
              id="lec-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://…/video.mp4"
            />
            <p className="text-[11px] text-muted-foreground">
              Acepta URLs públicas .mp4. Se reproduce inline en el portal.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="lec-min">Duración (min)</Label>
              <Input
                id="lec-min"
                type="number"
                min={1}
                value={duracionMin}
                onChange={(e) => setDuracionMin(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lec-fecha">Fecha de subida</Label>
              <Input
                id="lec-fecha"
                type="date"
                value={fechaSubida}
                onChange={(e) => setFechaSubida(e.target.value)}
              />
            </div>
          </div>

          {/* Recursos */}
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <Label>Recursos descargables (opcional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={añadirRecurso}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Añadir recurso
              </Button>
            </div>
            {recursos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin recursos. Puedes añadir PDFs, enlaces, imágenes…
              </p>
            ) : (
              <ul className="space-y-2">
                {recursos.map((r) => (
                  <li key={r.id} className="grid gap-2 sm:grid-cols-[1fr,1fr,90px,auto]">
                    <Input
                      value={r.titulo}
                      onChange={(e) =>
                        patchRecurso(r.id, { titulo: e.target.value })
                      }
                      placeholder="Título del recurso"
                      className="bg-background"
                    />
                    <Input
                      value={r.url}
                      onChange={(e) => patchRecurso(r.id, { url: e.target.value })}
                      placeholder="URL"
                      className="bg-background"
                    />
                    <Input
                      value={r.tipo}
                      onChange={(e) => patchRecurso(r.id, { tipo: e.target.value })}
                      placeholder="pdf"
                      className="bg-background"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => quitarRecurso(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="lg">
              {editing ? "Guardar cambios" : "Crear lección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
