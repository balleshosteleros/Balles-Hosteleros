"use client";

// Panel admin del Portal de Formación.
// Vive dentro de /rrhh/formacion (lo embebe FormacionView).
// Pestañas: Novedades · Cursos. Desde Cursos se entra al editor anidado del
// curso (secciones + lecciones).

import { useMemo, useState } from "react";
import {
  Bell,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  useFormacionStore,
  leccionesOrdenadas,
} from "../../store/use-formacion-store";
import type { Curso, NovedadFormacion } from "../../types";
import { NovedadFormDialog } from "./NovedadFormDialog";
import { CursoFormDialog } from "./CursoFormDialog";
import { CursoEditor } from "./CursoEditor";

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AdminFormacionPanel() {
  const { empresaActual } = useEmpresa();
  const cursos = useFormacionStore((s) => s.cursos);
  const secciones = useFormacionStore((s) => s.secciones);
  const lecciones = useFormacionStore((s) => s.lecciones);
  const novedades = useFormacionStore((s) => s.novedades);
  const updateCurso = useFormacionStore((s) => s.updateCurso);
  const removeCurso = useFormacionStore((s) => s.removeCurso);
  const removeNovedad = useFormacionStore((s) => s.removeNovedad);
  const resetSeed = useFormacionStore((s) => s.resetSeed);

  const [editingNovedad, setEditingNovedad] = useState<
    NovedadFormacion | null | "new"
  >(null);
  const [editingCurso, setEditingCurso] = useState<Curso | null | "new">(null);
  const [openCursoEditorId, setOpenCursoEditorId] = useState<string | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<
    { type: "novedad" | "curso"; id: string; titulo: string } | null
  >(null);

  const cursosEmpresa = useMemo(
    () =>
      cursos
        .filter((c) => c.empresaId === empresaActual.id)
        .sort((a, b) => {
          if (a.ambito !== b.ambito) return a.ambito === "general" ? -1 : 1;
          return a.orden - b.orden;
        }),
    [cursos, empresaActual.id],
  );

  const novedadesEmpresa = useMemo(
    () =>
      [...novedades]
        .filter((n) => n.empresaId === empresaActual.id)
        .sort(
          (a, b) =>
            new Date(b.fechaPublicacion).getTime() -
            new Date(a.fechaPublicacion).getTime(),
        ),
    [novedades, empresaActual.id],
  );

  function confirmDelete() {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "novedad") removeNovedad(deleteConfirm.id);
    else removeCurso(deleteConfirm.id);
    setDeleteConfirm(null);
  }

  // Si el admin está editando un curso concreto, mostramos su editor en vez de la lista.
  if (openCursoEditorId) {
    return (
      <CursoEditor
        cursoId={openCursoEditorId}
        onClose={() => setOpenCursoEditorId(null)}
      />
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-primary" />
            Gestión del Portal de Formación
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {empresaActual.nombre}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (
              confirm(
                "¿Restaurar contenido de ejemplo? Se perderán los cambios manuales.",
              )
            ) {
              resetSeed();
            }
          }}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Restaurar ejemplo
        </Button>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="cursos" className="w-full">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="cursos">Cursos</TabsTrigger>
            <TabsTrigger value="novedades">Novedades</TabsTrigger>
          </TabsList>

          {/* ─── CURSOS ────────────────────────────── */}
          <TabsContent value="cursos" className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Cada curso es un classroom con secciones y lecciones (vídeos).
                Asigna el ámbito (general o por puesto) y publícalo cuando esté
                listo.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setEditingCurso("new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo curso
              </Button>
            </div>

            {cursosEmpresa.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Aún no hay cursos.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead className="w-[140px]">Ámbito</TableHead>
                      <TableHead className="w-[100px] text-center">
                        Lecciones
                      </TableHead>
                      <TableHead className="w-[110px]">Publicado</TableHead>
                      <TableHead className="w-[110px]">Actualizado</TableHead>
                      <TableHead className="w-[200px] text-right">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cursosEmpresa.map((c) => {
                      const total = leccionesOrdenadas(secciones, lecciones, c.id)
                        .length;
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.titulo}</div>
                            <div className="line-clamp-1 text-xs text-muted-foreground">
                              {c.descripcion}
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.ambito === "general" ? (
                              <Badge variant="outline">General</Badge>
                            ) : (
                              <Badge variant="secondary">
                                {c.puesto ?? ""}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{total}</TableCell>
                          <TableCell>
                            {c.publicado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                <Eye className="mr-1 h-3 w-3" />
                                Publicado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                <EyeOff className="mr-1 h-3 w-3" />
                                Borrador
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatFecha(c.fechaPublicacion)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              title={c.publicado ? "Despublicar" : "Publicar"}
                              onClick={() =>
                                updateCurso(c.id, { publicado: !c.publicado })
                              }
                            >
                              {c.publicado ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-1"
                              onClick={() => setOpenCursoEditorId(c.id)}
                            >
                              Contenido
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCurso(c)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "curso",
                                  id: c.id,
                                  titulo: c.titulo,
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── NOVEDADES ─────────────────────────── */}
          <TabsContent value="novedades" className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Lo que ven los empleados en la cabecera de su portal durante 3
                meses tras su publicación.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setEditingNovedad("new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva novedad
              </Button>
            </div>

            {novedadesEmpresa.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <Bell className="h-4 w-4" />
                Aún no hay novedades.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Audiencia</TableHead>
                      <TableHead className="w-[110px]">Fecha</TableHead>
                      <TableHead className="w-[110px] text-right">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novedadesEmpresa.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {n.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{n.titulo}</div>
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {n.descripcion}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {n.audiencia === "todos"
                            ? "Todo el equipo"
                            : n.audiencia.join(", ")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatFecha(n.fechaPublicacion)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingNovedad(n)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteConfirm({
                                type: "novedad",
                                id: n.id,
                                titulo: n.titulo,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Diálogos */}
      {editingNovedad !== null && (
        <NovedadFormDialog
          empresaId={empresaActual.id}
          cursos={cursosEmpresa}
          lecciones={lecciones.filter(
            (l) =>
              cursosEmpresa.find((c) => c.id === l.cursoId)?.empresaId ===
              empresaActual.id,
          )}
          novedad={editingNovedad === "new" ? null : editingNovedad}
          onClose={() => setEditingNovedad(null)}
        />
      )}
      {editingCurso !== null && (
        <CursoFormDialog
          empresaId={empresaActual.id}
          curso={editingCurso === "new" ? null : editingCurso}
          onClose={() => setEditingCurso(null)}
          onSaved={(id) => {
            setEditingCurso(null);
            // Si era nuevo, abrimos su editor para añadir contenido.
            if (editingCurso === "new") setOpenCursoEditorId(id);
          }}
        />
      )}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este elemento?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{deleteConfirm?.titulo}</strong>.{" "}
              {deleteConfirm?.type === "curso"
                ? "Se borrarán todas sus secciones y lecciones."
                : ""}{" "}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
