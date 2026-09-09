"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { EyeOff, Pencil, Plus, Trash2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import {
  useFormacionStore,
  leccionesOrdenadas,
} from "@/features/formacion/store/use-formacion-store";
import type { Curso } from "@/features/formacion/types";
import { CursoEscuelaDialog } from "./CursoEscuelaDialog";
import { ImportarYoutubeDialog } from "./ImportarYoutubeDialog";

/**
 * Cursos de la escuela. Cada tarjeta abre su editor, donde se montan los
 * módulos y las lecciones (el mismo editor que la formación de plantilla).
 *
 * Los cursos viven en las tablas de formación con ámbito «escuela», así que
 * nunca aparecen en RRHH ni en Mi panel.
 */
export function CursosTab() {
  const router = useRouter();
  const { cursos, secciones, lecciones, hydrate, addCurso, updateCurso, removeCurso } =
    useFormacionStore();
  const ambitoCargado = useFormacionStore((s) => s.ambito);
  const [editando, setEditando] = useState<Curso | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [importando, setImportando] = useState<Curso | null>(null);
  const { confirm, dialog } = useConfirmDelete();

  useEffect(() => {
    if (ambitoCargado !== "escuela") void hydrate("", { ambito: "escuela" });
  }, [ambitoCargado, hydrate]);

  const tarjetas = useMemo(
    () =>
      cursos
        .filter((c) => c.ambito === "escuela")
        .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo))
        .map((c) => ({
          curso: c,
          modulos: secciones.filter((s) => s.cursoId === c.id).length,
          lecciones: leccionesOrdenadas(secciones, lecciones, c.id).length,
        })),
    [cursos, secciones, lecciones],
  );

  async function eliminar(curso: Curso) {
    const ok = await confirm({
      title: "Borrar el curso",
      description: `«${curso.titulo}» se borra con todos sus módulos y lecciones.`,
    });
    if (!ok) return;
    removeCurso(curso.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Button
          className="ml-auto"
          onClick={() => {
            setEditando(null);
            setAbierto(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo curso
        </Button>
      </div>

      {tarjetas.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tarjetas.map(({ curso, modulos, lecciones: numLecciones }) => {
            const esImagen = !!curso.cover && /^https?:\/\//.test(curso.cover);
            return (
              <div key={curso.id} className="overflow-hidden rounded-2xl border bg-background">
                <button
                  type="button"
                  onClick={() => router.push(`/producto/escuela/curso/${curso.id}`)}
                  className="block w-full text-left"
                >
                  <div
                    className="relative aspect-video w-full bg-muted"
                    style={
                      !esImagen
                        ? {
                            background:
                              curso.cover ||
                              "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.5) 100%)",
                          }
                        : undefined
                    }
                  >
                    {esImagen ? (
                      <Image
                        src={curso.cover as string}
                        alt={curso.titulo}
                        fill
                        sizes="360px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 truncate font-semibold">{curso.titulo}</h3>
                      {!curso.publicado ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <EyeOff className="h-3 w-3" />
                          Oculto
                        </Badge>
                      ) : null}
                      {curso.proximamente ? (
                        <Badge variant="outline" className="text-xs">
                          Próximamente
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {modulos} {modulos === 1 ? "módulo" : "módulos"} · {numLecciones}{" "}
                      {numLecciones === 1 ? "lección" : "lecciones"}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1 border-t px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditando(curso);
                      setAbierto(true);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImportando(curso)}
                    title="Traer vídeos de YouTube"
                  >
                    <MonitorPlay className="mr-2 h-3.5 w-3.5 text-red-600" />
                    YouTube
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={() => eliminar(curso)}
                    aria-label="Borrar"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay ningún curso en la escuela.
        </div>
      )}

      <CursoEscuelaDialog
        abierto={abierto}
        curso={editando}
        onCerrar={() => setAbierto(false)}
        onGuardar={(datos) => {
          if (editando) {
            updateCurso(editando.id, datos);
            return;
          }
          addCurso({
            titulo: datos.titulo,
            descripcion: datos.descripcion,
            cover: datos.cover || undefined,
            categoria: "otros",
            ambito: "escuela",
            empresaId: "",
            orden: cursos.filter((c) => c.ambito === "escuela").length,
            fechaPublicacion: new Date().toISOString().slice(0, 10),
            autor: "",
            publicado: datos.publicado,
            proximamente: datos.proximamente,
          });
        }}
      />
      <ImportarYoutubeDialog
        abierto={!!importando}
        cursoId={importando?.id ?? ""}
        cursoTitulo={importando?.titulo ?? ""}
        onCerrar={() => setImportando(null)}
        onImportado={() => void hydrate("", { ambito: "escuela" })}
      />
      {dialog}
    </div>
  );
}
