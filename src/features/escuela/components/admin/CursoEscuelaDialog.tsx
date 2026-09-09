"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Curso } from "@/features/formacion/types";

/**
 * Alta y edición del CURSO de la escuela.
 *
 * Es más corto que el de la formación de plantilla a propósito: aquí no hay
 * puesto al que atarlo ni ámbito que elegir — todo lo que se crea desde esta
 * pantalla es de la escuela.
 */
export function CursoEscuelaDialog({
  abierto,
  curso,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  curso: Curso | null;
  onCerrar: () => void;
  onGuardar: (datos: {
    titulo: string;
    descripcion: string;
    cover: string;
    publicado: boolean;
    proximamente: boolean;
  }) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cover, setCover] = useState("");
  const [publicado, setPublicado] = useState(true);
  const [proximamente, setProximamente] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setError("");
    setTitulo(curso?.titulo ?? "");
    setDescripcion(curso?.descripcion ?? "");
    setCover(curso?.cover ?? "");
    setPublicado(curso?.publicado ?? true);
    setProximamente(curso?.proximamente ?? false);
  }, [abierto, curso]);

  function guardar() {
    if (!titulo.trim()) {
      setError("El curso necesita un título.");
      return;
    }
    onGuardar({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      cover: cover.trim(),
      publicado,
      proximamente,
    });
    onCerrar();
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{curso ? "Editar curso" : "Nuevo curso"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo-curso">Título</Label>
            <Input
              id="titulo-curso"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Máster en dirección y gestión hostelera"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc-curso">Descripción</Label>
            <Textarea
              id="desc-curso"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cover-curso">Portada</Label>
            <Input
              id="cover-curso"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="Dirección de una imagen (opcional)"
            />
            <p className="text-xs text-muted-foreground">
              Si la dejas vacía, la portada se pinta con la imagen de marca.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Visible para los alumnos</p>
              <p className="text-xs text-muted-foreground">
                Mientras lo montas, tenlo apagado.
              </p>
            </div>
            <Switch checked={publicado} onCheckedChange={setPublicado} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Próximamente</p>
              <p className="text-xs text-muted-foreground">
                Se anuncia con su portada, pero todavía no se puede abrir.
              </p>
            </div>
            <Switch checked={proximamente} onCheckedChange={setProximamente} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
