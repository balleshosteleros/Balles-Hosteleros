"use client";

// Dialog de alta / edición de un curso (metadatos del classroom).
// El contenido (secciones + lecciones) se gestiona en CursoEditor.

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormacionStore } from "../../store/use-formacion-store";
import { usePuestosEmpresa } from "../../hooks/use-puestos-empresa";
import {
  type CategoriaCurso,
  type Curso,
} from "../../types";

const CATEGORIAS: CategoriaCurso[] = [
  "bienvenida",
  "cultura",
  "protocolo",
  "seguridad",
  "operativa",
  "atencion",
  "otros",
];

const COVERS_PRESET: { id: string; label: string; gradient: string }[] = [
  {
    id: "azul",
    label: "Azul",
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%)",
  },
  {
    id: "verde",
    label: "Verde",
    gradient: "linear-gradient(135deg, #065f46 0%, #10b981 50%, #6ee7b7 100%)",
  },
  {
    id: "naranja",
    label: "Naranja",
    gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fdba74 100%)",
  },
  {
    id: "violeta",
    label: "Violeta",
    gradient: "linear-gradient(135deg, #581c87 0%, #9333ea 50%, #d8b4fe 100%)",
  },
  {
    id: "ambar",
    label: "Ámbar",
    gradient: "linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fde68a 100%)",
  },
  {
    id: "rosa",
    label: "Rosa",
    gradient: "linear-gradient(135deg, #831843 0%, #db2777 50%, #fbcfe8 100%)",
  },
  {
    id: "indigo",
    label: "Índigo",
    gradient: "linear-gradient(135deg, #312e81 0%, #6366f1 50%, #c7d2fe 100%)",
  },
  {
    id: "teal",
    label: "Teal",
    gradient: "linear-gradient(135deg, #064e3b 0%, #0d9488 50%, #99f6e4 100%)",
  },
];

interface Props {
  empresaId: string;
  curso: Curso | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

export function CursoFormDialog({ empresaId, curso, onClose, onSaved }: Props) {
  const addCurso = useFormacionStore((s) => s.addCurso);
  const updateCurso = useFormacionStore((s) => s.updateCurso);
  const cursos = useFormacionStore((s) => s.cursos);
  const { puestos } = usePuestosEmpresa();

  const today = new Date().toISOString().slice(0, 10);

  const [titulo, setTitulo] = useState(curso?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(curso?.descripcion ?? "");
  const [cover, setCover] = useState(
    curso?.cover ?? COVERS_PRESET[0].gradient,
  );
  const [categoria, setCategoria] = useState<CategoriaCurso>(
    curso?.categoria ?? "operativa",
  );
  const [ambito, setAmbito] = useState<"general" | "puesto">(
    curso?.ambito ?? "general",
  );
  const [puestoId, setPuestoId] = useState<string>(curso?.puestoId ?? "");
  const [autor, setAutor] = useState(curso?.autor ?? "RRHH");
  const [fechaPublicacion, setFechaPublicacion] = useState(
    curso?.fechaPublicacion ?? today,
  );
  const [publicado, setPublicado] = useState(curso?.publicado ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;

    const ordenSiguiente =
      cursos.filter((c) => c.empresaId === empresaId).length + 1;

    const puestoSel = puestos.find((p) => p.id === puestoId);
    const payload: Omit<Curso, "id"> = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      cover,
      categoria,
      ambito,
      puesto: ambito === "puesto" ? puestoSel?.nombre : undefined,
      puestoId: ambito === "puesto" ? (puestoId || undefined) : undefined,
      empresaId,
      orden: curso?.orden ?? ordenSiguiente,
      fechaPublicacion,
      autor: autor.trim() || "RRHH",
      publicado,
    };

    try {
      if (curso) {
        updateCurso(curso.id, payload);
        onSaved?.(curso.id);
      } else {
        const id = addCurso(payload);
        onSaved?.(id);
      }
    } catch (err) {
      console.error("[formacion] error guardando curso", err);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{curso ? "Editar curso" : "Nuevo curso"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cur-tit">Título</Label>
            <Input
              id="cur-tit"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              placeholder="Ej: Camarero — protocolo de sala"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cur-desc">Descripción</Label>
            <Textarea
              id="cur-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Para qué sirve este curso y qué aprende el empleado."
            />
          </div>

          <div className="grid gap-2">
            <Label>Portada</Label>
            <div className="grid grid-cols-4 gap-2">
              {COVERS_PRESET.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCover(p.gradient)}
                  className={`aspect-[16/9] rounded-md border-2 transition ${
                    cover === p.gradient
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                  style={{ background: p.gradient }}
                  aria-label={p.label}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as CategoriaCurso)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Ámbito</Label>
              <Select
                value={ambito}
                onValueChange={(v) => setAmbito(v as "general" | "puesto")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="puesto">Por puesto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ambito === "puesto" && (
              <div className="grid gap-2">
                <Label>Puesto</Label>
                <Select value={puestoId} onValueChange={setPuestoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un puesto" />
                  </SelectTrigger>
                  <SelectContent>
                    {puestos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cur-fecha">Fecha de publicación</Label>
              <Input
                id="cur-fecha"
                type="date"
                value={fechaPublicacion}
                onChange={(e) => setFechaPublicacion(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cur-autor">Autor</Label>
              <Input
                id="cur-autor"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="RRHH"
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Publicar curso</div>
              <p className="text-xs text-muted-foreground">
                Si lo dejas en borrador, los empleados no lo ven aún.
              </p>
            </div>
            <Switch checked={publicado} onCheckedChange={setPublicado} />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="lg">
              {curso ? "Guardar" : "Crear curso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
