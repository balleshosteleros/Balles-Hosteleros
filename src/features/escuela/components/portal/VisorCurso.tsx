"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Circle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { analizarVideo } from "../../lib/video";
import { marcarLeccionVista } from "../../actions/portal-actions";
import type { CursoDetallePortal, LeccionPortal } from "../../services/portal-alumno";

/**
 * Visor del curso: vídeo a un lado, índice al otro.
 *
 * El vídeo se ve DESDE YouTube (incrustado): ni se descarga ni se guarda en
 * nuestro almacenamiento. Debajo va el texto de la lección tal cual está
 * escrito, que es lo que el alumno viene a leer además de ver.
 */
export function VisorCurso({
  curso,
  leccionInicial,
}: {
  curso: CursoDetallePortal;
  leccionInicial?: string;
}) {
  const todas = useMemo(
    () => curso.modulos.flatMap((m) => m.lecciones),
    [curso],
  );
  const [actualId, setActualId] = useState<string>(
    () => leccionInicial ?? todas.find((l) => !l.completada)?.id ?? todas[0]?.id ?? "",
  );
  const [completadas, setCompletadas] = useState<Set<string>>(
    () => new Set(todas.filter((l) => l.completada).map((l) => l.id)),
  );
  const [guardando, iniciarGuardado] = useTransition();

  const actual: LeccionPortal | undefined = todas.find((l) => l.id === actualId);
  const video = analizarVideo(actual?.videoUrl);
  const hechas = completadas.size;
  const porcentaje = todas.length ? Math.round((hechas / todas.length) * 100) : 0;

  function alternarVista(leccion: LeccionPortal) {
    const marcar = !completadas.has(leccion.id);
    // Se pinta al instante y se guarda detrás: marcar una lección no debe
    // dejar al alumno esperando.
    setCompletadas((prev) => {
      const copia = new Set(prev);
      if (marcar) copia.add(leccion.id);
      else copia.delete(leccion.id);
      return copia;
    });
    iniciarGuardado(async () => {
      const res = await marcarLeccionVista(leccion.id, marcar);
      if (!res.ok) {
        setCompletadas((prev) => {
          const copia = new Set(prev);
          if (marcar) copia.delete(leccion.id);
          else copia.add(leccion.id);
          return copia;
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/escuela/cursos">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Cursos
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">{curso.titulo}</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {hechas} de {todas.length} · {porcentaje}%
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-black">
            {video.tipo === "youtube" || video.tipo === "vimeo" ? (
              <div className="relative aspect-video w-full">
                <iframe
                  key={video.src}
                  src={video.src}
                  title={actual?.titulo ?? curso.titulo}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : video.tipo === "archivo" ? (
              <video key={video.src} src={video.src} controls className="aspect-video w-full" />
            ) : (
              <div className="grid aspect-video w-full place-items-center text-sm text-white/60">
                Esta lección todavía no tiene vídeo.
              </div>
            )}
          </div>

          {actual ? (
            <div className="rounded-2xl border bg-background p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold">{actual.titulo}</h2>
                  {actual.duracionMin ? (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {actual.duracionMin} min
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={completadas.has(actual.id) ? "outline" : "default"}
                  disabled={guardando}
                  onClick={() => alternarVista(actual)}
                  style={
                    completadas.has(actual.id)
                      ? undefined
                      : { background: "var(--marca-primario)", color: "var(--marca-texto)" }
                  }
                >
                  <Check className="mr-2 h-4 w-4" />
                  {completadas.has(actual.id) ? "Vista" : "Marcar como vista"}
                </Button>
              </div>

              {actual.descripcion || actual.contenido ? (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acerca de esta lección
                  </p>
                  {actual.descripcion ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed">{actual.descripcion}</p>
                  ) : null}
                  {actual.contenido ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed">{actual.contenido}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
          {curso.modulos.map((m) => (
            <section key={m.id} className="overflow-hidden rounded-2xl border bg-background">
              <header className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide">{m.titulo}</h3>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {m.lecciones.length} {m.lecciones.length === 1 ? "lección" : "lecciones"}
                </span>
              </header>
              <ul>
                {m.lecciones.map((l, i) => {
                  const esActual = l.id === actualId;
                  const vista = completadas.has(l.id);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setActualId(l.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          esActual ? "text-white" : "hover:bg-muted/60",
                        )}
                        style={esActual ? { background: "var(--marca-primario)" } : undefined}
                      >
                        <span
                          className={cn(
                            "w-4 shrink-0 text-xs",
                            esActual ? "text-white/80" : "text-muted-foreground",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-sm leading-snug">{l.titulo}</span>
                        {vista ? (
                          <Check
                            className={cn("h-4 w-4 shrink-0", esActual ? "text-white" : "text-emerald-600")}
                          />
                        ) : (
                          <Circle
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              esActual ? "text-white/60" : "text-muted-foreground/40",
                            )}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
