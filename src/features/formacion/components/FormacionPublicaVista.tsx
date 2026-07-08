"use client";

// Visor PÚBLICO de solo lectura del curso de formación de un candidato.
// Sin sesión, sin store, sin progreso ni interacción: reproductor de vídeo +
// lista de lecciones + texto/documento de la lección activa. Los datos llegan
// ya resueltos por token desde el servidor (fetchFormacionPorToken).

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  FileDown,
  GraduationCap,
  ListChecks,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  FormacionPublica,
  LeccionPublica,
} from "../services/formacion-publica";

export function FormacionPublicaVista({ datos }: { datos: FormacionPublica }) {
  // Lecciones en orden plano (para Anterior/Siguiente).
  const ordenadas = useMemo<LeccionPublica[]>(
    () => datos.secciones.flatMap((s) => s.lecciones),
    [datos.secciones],
  );

  const [activaId, setActivaId] = useState<string | null>(
    ordenadas[0]?.id ?? null,
  );
  const activa = ordenadas.find((l) => l.id === activaId) ?? ordenadas[0] ?? null;
  const idx = activa ? ordenadas.findIndex((l) => l.id === activa.id) : -1;
  const anterior = idx > 0 ? ordenadas[idx - 1] : undefined;
  const siguiente = idx >= 0 ? ordenadas[idx + 1] : undefined;

  const totalMin = ordenadas.reduce((acc, l) => acc + l.duracionMin, 0);
  const primerNombre = datos.candidatoNombre.split(" ")[0] || "";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5" />
          Formación {datos.puestoNombre ? `· ${datos.puestoNombre}` : ""}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {datos.cursoTitulo || "Tu formación"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {primerNombre ? `Hola ${primerNombre}, ` : ""}esta es la formación de tu
          puesto. Revísala completa desde un ordenador con pantalla grande.
        </p>
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <Badge variant="secondary">
            {ordenadas.length} {ordenadas.length === 1 ? "lección" : "lecciones"}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {totalMin} min
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        {/* ─── Reproductor + info ─────────────────────────────── */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative aspect-video w-full bg-black">
              {activa && activa.videoUrl ? (
                <video
                  key={activa.id}
                  src={activa.videoUrl}
                  controls
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/70">
                  {activa
                    ? "Esta lección no tiene vídeo."
                    : "Este curso aún no tiene lecciones."}
                </div>
              )}
            </div>

            {activa && (
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Lección {idx + 1} de {ordenadas.length}
                    <span>· {activa.duracionMin} min</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    {activa.titulo}
                  </h2>
                </div>

                {activa.descripcion && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activa.descripcion}
                  </p>
                )}

                {activa.contenido && (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {activa.contenido}
                  </div>
                )}

                {activa.documentoUrl && (
                  <a
                    href={activa.documentoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:border-primary"
                  >
                    <FileDown className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">
                      {activa.documentoNombre ?? "Documento de la lección"}
                    </span>
                    {activa.documentoTipo && (
                      <Badge variant="outline" className="text-[10px]">
                        {activa.documentoTipo}
                      </Badge>
                    )}
                  </a>
                )}

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => anterior && setActivaId(anterior.id)}
                    disabled={!anterior}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => siguiente && setActivaId(siguiente.id)}
                    disabled={!siguiente}
                  >
                    Siguiente
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* ─── Índice de lecciones ────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            Contenido del curso
          </div>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-2 space-y-3">
              {datos.secciones.map((sec) => (
                <div key={sec.id} className="space-y-1">
                  <div className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {sec.titulo}
                  </div>
                  {sec.lecciones.map((l) => {
                    const activo = l.id === activa?.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setActivaId(l.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                          activo
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <PlayCircle
                          className={`h-4 w-4 shrink-0 ${
                            activo ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span className="flex-1 leading-tight">{l.titulo}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {l.duracionMin}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
