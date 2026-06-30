"use client";

// Vista classroom de un curso (estilo Skool):
// - Layout 2 columnas: vídeo + descripción (izq) y lista de secciones+lecciones (der)
// - Reproductor HTML5 con autoplay al cambiar de lección
// - Marcar lección como completada (manual) y avanzar
// - Botón "Anterior / Siguiente"

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  FileDown,
  GraduationCap,
  ListChecks,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { toast } from "sonner";
import {
  useFormacionStore,
  avanceCurso,
  duracionCurso,
  leccionesDeCurso,
  leccionesOrdenadas,
} from "../store/use-formacion-store";
import { LeccionInteraccion } from "./LeccionInteraccion";
import { CursoEditorSidebar } from "./admin/CursoEditorSidebar";

interface Props {
  cursoId: string;
  /** Vista de administración (RRHH). Reservado para acciones de edición. */
  admin?: boolean;
}

export function CursoVista({ cursoId, admin = false }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const { profile } = useAuth();
  const userKey = profile?.email ?? "anon";

  const cursos = useFormacionStore((s) => s.cursos);
  const secciones = useFormacionStore((s) => s.secciones);
  const lecciones = useFormacionStore((s) => s.lecciones);
  const completadas = useFormacionStore((s) => s.completadas);
  const marcarCompletada = useFormacionStore((s) => s.marcarCompletada);
  const desmarcarCompletada = useFormacionStore((s) => s.desmarcarCompletada);
  const hydrate = useFormacionStore((s) => s.hydrate);
  const hydrated = useFormacionStore((s) => s.hydrated);

  // Si se entra directo a la URL del curso, carga el módulo desde BD.
  useEffect(() => {
    if (!hydrated) void hydrate(userKey);
  }, [hydrated, hydrate, userKey]);

  const curso = cursos.find((c) => c.id === cursoId);
  // El admin ve todo; el alumno solo temas y lecciones publicados.
  const seccionesVis = useMemo(
    () => (admin ? secciones : secciones.filter((s) => s.publicado !== false)),
    [secciones, admin],
  );
  const leccionesVis = useMemo(
    () => (admin ? lecciones : lecciones.filter((l) => l.publicado !== false)),
    [lecciones, admin],
  );

  const ordenadas = useMemo(
    () => leccionesOrdenadas(seccionesVis, leccionesVis, cursoId),
    [seccionesVis, leccionesVis, cursoId],
  );
  const { secciones: cs, leccionesPorSeccion } = useMemo(
    () => leccionesDeCurso(seccionesVis, leccionesVis, cursoId),
    [seccionesVis, leccionesVis, cursoId],
  );

  // Lección activa: ?leccion=... → primera no completada → primera del curso
  const leccionParam = search.get("leccion");
  const primeraSinCompletar = ordenadas.find(
    (l) => !completadas[`${userKey}:${l.id}`],
  );
  const leccionInicial =
    (leccionParam && ordenadas.find((l) => l.id === leccionParam)) ||
    primeraSinCompletar ||
    ordenadas[0];

  const [activaId, setActivaId] = useState<string | null>(
    leccionInicial?.id ?? null,
  );

  useEffect(() => {
    if (leccionParam && leccionParam !== activaId) setActivaId(leccionParam);
  }, [leccionParam, activaId]);

  if (!curso) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 space-y-2">
            <h2 className="text-lg font-semibold">Curso no encontrado</h2>
            <p className="text-sm text-muted-foreground">
              Es posible que se haya eliminado.
            </p>
            <Button asChild variant="primary" size="lg">
              <Link href="/mi-panel/formacion">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Volver al portal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activa = ordenadas.find((l) => l.id === activaId) ?? ordenadas[0];
  const idxActual = activa
    ? ordenadas.findIndex((l) => l.id === activa.id)
    : -1;
  const siguiente = idxActual >= 0 ? ordenadas[idxActual + 1] : undefined;
  const anterior = idxActual > 0 ? ordenadas[idxActual - 1] : undefined;
  const a = avanceCurso(secciones, lecciones, completadas, userKey, cursoId);

  function activarLeccion(id: string) {
    setActivaId(id);
    // Mantener URL en sincronía sin recargar.
    const params = new URLSearchParams(search.toString());
    params.set("leccion", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function toggleCompletada(id: string) {
    if (completadas[`${userKey}:${id}`]) {
      desmarcarCompletada(userKey, id);
    } else {
      marcarCompletada(userKey, id);
    }
  }

  function completarYAvanzar() {
    if (!activa) return;
    if (!completadas[`${userKey}:${activa.id}`]) {
      marcarCompletada(userKey, activa.id);
    }
    if (siguiente) activarLeccion(siguiente.id);
  }

  const totalMin = duracionCurso(secciones, lecciones, cursoId);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Breadcrumb / header */}
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/mi-panel/formacion">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Portal de Formación
          </Link>
        </Button>
        <div className="hidden items-center gap-2 sm:flex">
          <Badge variant="secondary">
            {curso.ambito === "general" ? "General" : (curso.puesto ?? "")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {ordenadas.length}{" "}
            {ordenadas.length === 1 ? "lección" : "lecciones"} · {totalMin} min
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,360px]">
        {/* ─── Columna izq: reproductor + info ───────────────── */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative aspect-video w-full bg-black">
              {activa ? (
                <video
                  key={activa.id}
                  src={activa.url}
                  controls
                  autoPlay
                  className="h-full w-full"
                  onEnded={() => marcarCompletada(userKey, activa.id)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/70">
                  Este curso aún no tiene lecciones.
                </div>
              )}
            </div>
            {activa && (
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Lección {idxActual + 1} de {ordenadas.length}
                    <span>· {activa.duracionMin} min</span>
                  </div>
                  <h1 className="text-xl font-bold text-foreground">
                    {activa.titulo}
                  </h1>
                </div>

                {activa.descripcion && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activa.descripcion}
                  </p>
                )}

                {activa.recursos.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recursos
                    </div>
                    <ul className="space-y-1.5">
                      {activa.recursos.map((r) => (
                        <li key={r.id}>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:border-primary"
                          >
                            <FileDown className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{r.titulo}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {r.tipo}
                            </Badge>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => anterior && activarLeccion(anterior.id)}
                      disabled={!anterior}
                    >
                      <ArrowLeft className="mr-1 h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => siguiente && activarLeccion(siguiente.id)}
                      disabled={!siguiente}
                    >
                      Siguiente
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleCompletada(activa.id)}
                    >
                      {completadas[`${userKey}:${activa.id}`] ? (
                        <>
                          <Circle className="mr-1 h-4 w-4" />
                          Marcar no vista
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Marcar vista
                        </>
                      )}
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={completarYAvanzar}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      {siguiente ? "Completar y siguiente" : "Completar curso"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Panel de la lección: texto libre, documento incrustado, me gusta,
              preguntas a RRHH y cuestionario tipo test. */}
          {activa && (
            <LeccionInteraccion
              cursoId={cursoId}
              leccionId={activa.id}
              contenido={activa.contenido}
              documentoPath={activa.documentoPath}
              documentoTipo={activa.documentoTipo}
              documentoNombre={activa.documentoNombre}
            />
          )}

          {/* Bloque de info del curso */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5" />
                Curso
              </div>
              <h2 className="text-lg font-bold">{curso.titulo}</h2>
              <p className="text-sm text-muted-foreground">{curso.descripcion}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tu progreso</span>
                <span className="font-semibold">{a.pct}%</span>
              </div>
              <Progress value={a.pct} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                {a.vistas} de {a.total} lecciones completadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ─── Columna der: sidebar (editable si es admin) ──── */}
        {admin ? (
          <CursoEditorSidebar
            cursoId={cursoId}
            activaId={activa?.id ?? null}
            onSelect={activarLeccion}
          />
        ) : (
        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <ListChecks className="h-4 w-4 text-primary" />
                Contenido del curso
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {a.vistas}/{a.total}
              </Badge>
            </div>
            <ScrollArea className="max-h-[70vh]">
              <ul className="space-y-3 pr-2">
                {cs.map((sec) => {
                  const ls = leccionesPorSeccion.get(sec.id) ?? [];
                  return (
                    <li key={sec.id} className="space-y-1">
                      <div className="px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {sec.titulo}
                      </div>
                      <ul className="space-y-0.5">
                        {ls.map((l, i) => {
                          const completada =
                            !!completadas[`${userKey}:${l.id}`];
                          const activeRow = activa?.id === l.id;
                          return (
                            <li key={l.id}>
                              <button
                                type="button"
                                onClick={() => activarLeccion(l.id)}
                                className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                                  activeRow
                                    ? "bg-primary/10 text-foreground"
                                    : "hover:bg-muted"
                                }`}
                              >
                                <span className="mt-0.5 shrink-0">
                                  {completada ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </span>
                                <span className="flex-1">
                                  <span className="line-clamp-2 text-[13px] font-medium leading-snug">
                                    {i + 1}. {l.titulo}
                                  </span>
                                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {l.duracionMin} min
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                        {ls.length === 0 && (
                          <li className="px-2 text-xs text-muted-foreground">
                            Sin lecciones todavía.
                          </li>
                        )}
                      </ul>
                    </li>
                  );
                })}
                {cs.length === 0 && (
                  <li className="px-2 text-sm text-muted-foreground">
                    Este curso aún no tiene secciones.
                  </li>
                )}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
