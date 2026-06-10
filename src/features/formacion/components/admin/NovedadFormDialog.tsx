"use client";

// Diálogo de novedad. Permite enlazar opcionalmente a un curso y, dentro de
// ese curso, a una lección concreta.

import { useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  type Curso,
  type Leccion,
  type NovedadFormacion,
  type Puesto,
  type TipoNovedad,
} from "../../types";

const TIPOS: TipoNovedad[] = ["tarea", "leccion", "curso", "cambio", "aviso"];

interface Props {
  empresaId: string;
  cursos: Curso[];
  lecciones: Leccion[];
  novedad: NovedadFormacion | null;
  onClose: () => void;
}

export function NovedadFormDialog({
  empresaId,
  cursos,
  lecciones,
  novedad,
  onClose,
}: Props) {
  const addNovedad = useFormacionStore((s) => s.addNovedad);
  const updateNovedad = useFormacionStore((s) => s.updateNovedad);
  const { puestos } = usePuestosEmpresa();

  const today = new Date().toISOString().slice(0, 10);

  const [titulo, setTitulo] = useState(novedad?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(novedad?.descripcion ?? "");
  const [tipo, setTipo] = useState<TipoNovedad>(novedad?.tipo ?? "aviso");
  const [audienciaTodos, setAudienciaTodos] = useState(
    novedad ? novedad.audiencia === "todos" : true,
  );
  const [audienciaPuestos, setAudienciaPuestos] = useState<Puesto[]>(
    novedad && novedad.audiencia !== "todos" ? novedad.audiencia : [],
  );
  const [fechaPublicacion, setFechaPublicacion] = useState(
    novedad?.fechaPublicacion ?? today,
  );
  const [autor, setAutor] = useState(novedad?.autor ?? "RRHH");
  const [cursoId, setCursoId] = useState<string>(novedad?.cursoId ?? "");
  const [leccionId, setLeccionId] = useState<string>(novedad?.leccionId ?? "");

  const leccionesCurso = useMemo(
    () => (cursoId ? lecciones.filter((l) => l.cursoId === cursoId) : []),
    [lecciones, cursoId],
  );

  function togglePuesto(p: Puesto) {
    setAudienciaPuestos((curr) =>
      curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;

    const audiencia: NovedadFormacion["audiencia"] = audienciaTodos
      ? "todos"
      : audienciaPuestos.length > 0
        ? audienciaPuestos
        : "todos";

    const payload: Omit<NovedadFormacion, "id"> = {
      tipo,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      audiencia,
      fechaPublicacion,
      autor: autor.trim() || "RRHH",
      empresaId,
      cursoId: cursoId || undefined,
      leccionId: leccionId || undefined,
    };

    try {
      if (novedad) updateNovedad(novedad.id, payload);
      else addNovedad(payload);
      onClose();
    } catch (err) {
      console.error("[formacion] error guardando novedad", err);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {novedad ? "Editar novedad" : "Nueva novedad"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="nov-tit">Título</Label>
            <Input
              id="nov-tit"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              placeholder="Ej: Subido el curso de Atención VIP"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nov-desc">Descripción</Label>
            <Textarea
              id="nov-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Qué cambia o qué tiene que hacer el equipo."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as TipoNovedad)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nov-fecha">Fecha de publicación</Label>
              <Input
                id="nov-fecha"
                type="date"
                value={fechaPublicacion}
                onChange={(e) => setFechaPublicacion(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nov-autor">Publicado por</Label>
              <Input
                id="nov-autor"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="RRHH"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Audiencia</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={audienciaTodos}
                onCheckedChange={(v) => setAudienciaTodos(!!v)}
              />
              Todo el equipo
            </label>
            {!audienciaTodos && (
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
                {puestos.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={audienciaPuestos.includes(p.nombre)}
                      onCheckedChange={() => togglePuesto(p.nombre)}
                    />
                    {p.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Curso enlazado (opcional)</Label>
              <Select
                value={cursoId || "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? "" : v;
                  setCursoId(next);
                  setLeccionId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin curso</SelectItem>
                  {cursos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.ambito === "puesto" && c.puesto
                        ? `[${c.puesto}] ${c.titulo}`
                        : `[General] ${c.titulo}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Lección enlazada (opcional)</Label>
              <Select
                value={leccionId || "none"}
                onValueChange={(v) => setLeccionId(v === "none" ? "" : v)}
                disabled={!cursoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin lección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin lección</SelectItem>
                  {leccionesCurso.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Si enlazas un curso o lección, el empleado podrá abrirlo desde la
            novedad.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="lg">
              {novedad ? "Guardar cambios" : "Publicar novedad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
