"use client";

// Diálogo de alta / edición de lección. Permite gestionar la lista de
// recursos descargables (PDF, enlaces, imágenes...).

import { useState } from "react";
import { Paperclip, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
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
import { uploadFormacionDoc } from "../../actions/formacion-actions";
import type { Leccion } from "../../types";

type Mode =
  | { mode: "new"; seccionId: string }
  | { mode: "edit"; leccion: Leccion };

interface Props {
  cursoId: string;
  mode: Mode;
  onClose: () => void;
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
  const [url, setUrl] = useState(editing?.url ?? "");
  const [duracionMin, setDuracionMin] = useState<number>(
    editing?.duracionMin ?? 5,
  );
  const [fechaSubida, setFechaSubida] = useState(editing?.fechaSubida ?? today);
  const [documentoPath, setDocumentoPath] = useState(editing?.documentoPath ?? "");
  const [documentoNombre, setDocumentoNombre] = useState(editing?.documentoNombre ?? "");
  const [subiendo, setSubiendo] = useState(false);

  async function onElegirDocumento(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadFormacionDoc(fd);
    setSubiendo(false);
    if (res.ok && res.path) {
      setDocumentoPath(res.path);
      setDocumentoNombre(res.nombre ?? file.name);
    } else {
      toast.error(res.error ?? "No se pudo subir el documento");
    }
  }

  function quitarDocumento() {
    setDocumentoPath("");
    setDocumentoNombre("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !url.trim()) return;

    const comun = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      url: url.trim(),
      duracionMin: Math.max(1, Number(duracionMin) || 1),
      fechaSubida,
      documentoPath: documentoPath || undefined,
      documentoNombre: documentoNombre || undefined,
    };

    if (editing) {
      updateLeccion(editing.id, comun);
    } else {
      const ordenSiguiente =
        lecciones.filter((l) => l.seccionId === seccionId).length + 1;
      addLeccion({
        cursoId,
        seccionId,
        orden: ordenSiguiente,
        publicado: true,
        recursos: [],
        ...comun,
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

          {/* Documento adjunto (uno por tarea) */}
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <Label>Documento adjunto (opcional)</Label>
            {documentoPath ? (
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">{documentoNombre}</span>
                <Button type="button" variant="ghost" size="sm" onClick={quitarDocumento}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary/40">
                {subiendo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                {subiendo ? "Subiendo…" : "Adjuntar documento (PDF, Word, imagen…)"}
                <input
                  type="file"
                  className="hidden"
                  disabled={subiendo}
                  onChange={onElegirDocumento}
                />
              </label>
            )}
            <p className="text-[11px] text-muted-foreground">
              Se guarda en privado; el empleado lo descarga desde la tarea.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="lg">
              {editing ? "Guardar" : "Crear lección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
