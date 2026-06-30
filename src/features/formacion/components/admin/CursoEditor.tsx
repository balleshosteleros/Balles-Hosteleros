"use client";

// Editor anidado de un curso: lista las secciones; dentro de cada sección,
// las lecciones. Permite añadir/editar/borrar ambos niveles.

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Clock,
  Edit2,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFormacionStore } from "../../store/use-formacion-store";
import { leccionesDeCurso } from "../../store/use-formacion-store";
import type { Leccion, Seccion } from "../../types";
import { LeccionFormDialog } from "./LeccionFormDialog";

interface Props {
  cursoId: string;
  onClose: () => void;
}

export function CursoEditor({ cursoId, onClose }: Props) {
  const cursos = useFormacionStore((s) => s.cursos);
  const secciones = useFormacionStore((s) => s.secciones);
  const lecciones = useFormacionStore((s) => s.lecciones);
  const addSeccion = useFormacionStore((s) => s.addSeccion);
  const updateSeccion = useFormacionStore((s) => s.updateSeccion);
  const removeSeccion = useFormacionStore((s) => s.removeSeccion);
  const removeLeccion = useFormacionStore((s) => s.removeLeccion);

  const curso = cursos.find((c) => c.id === cursoId);

  const [nuevaSeccionTit, setNuevaSeccionTit] = useState("");
  const [editingSeccionId, setEditingSeccionId] = useState<string | null>(null);
  const [editingSeccionTit, setEditingSeccionTit] = useState("");
  const [editingLeccion, setEditingLeccion] = useState<
    | { mode: "new"; seccionId: string }
    | { mode: "edit"; leccion: Leccion }
    | null
  >(null);
  const [deleteSeccion, setDeleteSeccion] = useState<Seccion | null>(null);
  const [deleteLeccion, setDeleteLeccion] = useState<Leccion | null>(null);

  const cursoData = useMemo(
    () => leccionesDeCurso(secciones, lecciones, cursoId),
    [secciones, lecciones, cursoId],
  );

  if (!curso) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-muted-foreground">Curso no encontrado.</p>
          <Button variant="outline" onClick={onClose}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  function handleAddSeccion(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaSeccionTit.trim()) return;
    const ordenSiguiente = cursoData.secciones.length + 1;
    addSeccion({
      cursoId,
      titulo: nuevaSeccionTit.trim(),
      orden: ordenSiguiente,
      publicado: true,
    });
    setNuevaSeccionTit("");
  }

  function moverSeccion(seccion: Seccion, dir: "up" | "down") {
    const arr = cursoData.secciones;
    const idx = arr.findIndex((s) => s.id === seccion.id);
    const objetivoIdx = dir === "up" ? idx - 1 : idx + 1;
    if (objetivoIdx < 0 || objetivoIdx >= arr.length) return;
    const otra = arr[objetivoIdx];
    updateSeccion(seccion.id, { orden: otra.orden });
    updateSeccion(otra.id, { orden: seccion.orden });
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="-ml-2 h-7"
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            Volver a cursos
          </Button>
          <CardTitle className="text-base flex items-center gap-2">
            Contenido · {curso.titulo}
            {curso.ambito === "puesto" && curso.puesto && (
              <Badge variant="secondary" className="text-[10px]">
                {curso.puesto}
              </Badge>
            )}
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {cursoData.total} {cursoData.total === 1 ? "lección" : "lecciones"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Añadir sección */}
        <form
          onSubmit={handleAddSeccion}
          className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 sm:flex-row"
        >
          <Input
            value={nuevaSeccionTit}
            onChange={(e) => setNuevaSeccionTit(e.target.value)}
            placeholder="Nombre de la sección (ej: Apertura del servicio)"
            className="bg-background"
          />
          <Button type="submit" variant="primary" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Añadir sección
          </Button>
        </form>

        {cursoData.secciones.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Este curso aún no tiene secciones. Añade la primera arriba.
          </p>
        ) : (
          <ul className="space-y-3">
            {cursoData.secciones.map((sec, secIdx) => {
              const ls = cursoData.leccionesPorSeccion.get(sec.id) ?? [];
              return (
                <li key={sec.id} className="rounded-md border bg-card">
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    {editingSeccionId === sec.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (editingSeccionTit.trim()) {
                            updateSeccion(sec.id, {
                              titulo: editingSeccionTit.trim(),
                            });
                          }
                          setEditingSeccionId(null);
                        }}
                        className="flex flex-1 items-center gap-2"
                      >
                        <Input
                          autoFocus
                          value={editingSeccionTit}
                          onChange={(e) => setEditingSeccionTit(e.target.value)}
                          className="h-8"
                        />
                        <Button type="submit" size="sm" variant="primary">
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingSeccionId(null)}
                        >
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Sección {secIdx + 1}
                          </span>
                          <h3 className="text-sm font-semibold">{sec.titulo}</h3>
                          <Badge variant="outline" className="text-[10px]">
                            {ls.length} lec
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={secIdx === 0}
                            onClick={() => moverSeccion(sec, "up")}
                            title="Subir"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={secIdx === cursoData.secciones.length - 1}
                            onClick={() => moverSeccion(sec, "down")}
                            title="Bajar"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSeccionId(sec.id);
                              setEditingSeccionTit(sec.titulo);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteSeccion(sec)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Lecciones de la sección */}
                  <ul className="divide-y">
                    {ls.map((l, i) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex flex-1 items-start gap-2">
                          <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {i + 1}. {l.titulo}
                            </div>
                            {l.descripcion && (
                              <div className="line-clamp-1 text-xs text-muted-foreground">
                                {l.descripcion}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            <Clock className="mr-1 h-3 w-3" />
                            {l.duracionMin} min
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditingLeccion({ mode: "edit", leccion: l })
                            }
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteLeccion(l)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t bg-muted/40 px-3 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditingLeccion({ mode: "new", seccionId: sec.id })
                      }
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Añadir lección
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Diálogo de lección */}
      {editingLeccion && (
        <LeccionFormDialog
          cursoId={cursoId}
          mode={editingLeccion}
          onClose={() => setEditingLeccion(null)}
        />
      )}

      {/* Confirmaciones de borrado */}
      <AlertDialog
        open={!!deleteSeccion}
        onOpenChange={(o) => !o && setDeleteSeccion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la sección?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{deleteSeccion?.titulo}</strong> y todas
              sus lecciones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSeccion) removeSeccion(deleteSeccion.id);
                setDeleteSeccion(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteLeccion}
        onOpenChange={(o) => !o && setDeleteLeccion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la lección?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{deleteLeccion?.titulo}</strong>. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteLeccion) removeLeccion(deleteLeccion.id);
                setDeleteLeccion(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
