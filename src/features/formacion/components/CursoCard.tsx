"use client";

// Tarjeta de curso al estilo Skool: portada gradiente con título, badge de
// ámbito (general / puesto), barra de progreso y meta (lecciones · minutos).

import Link from "next/link";
import { CheckCircle2, GraduationCap, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Curso } from "../types";

interface Props {
  curso: Curso;
  totalLecciones: number;
  totalMinutos: number;
  avancePct: number;
  destacar?: boolean;
}

export function CursoCard({
  curso,
  totalLecciones,
  totalMinutos,
  avancePct,
  destacar,
}: Props) {
  const completado = avancePct === 100 && totalLecciones > 0;
  const cover = curso.cover ?? "linear-gradient(135deg, #1e3a8a, #2563eb)";

  return (
    <Link
      href={`/mi-panel/formacion/curso/${curso.id}`}
      className="group block focus:outline-none"
    >
      <Card
        className={`overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg ${
          destacar ? "ring-2 ring-amber-400" : ""
        }`}
      >
        {/* Portada */}
        <div
          className="relative aspect-[16/9] w-full"
          style={{ background: cover }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
            <Badge className="bg-white/90 text-slate-900 hover:bg-white">
              {curso.ambito === "general" ? "General" : (curso.puesto ?? "")}
            </Badge>
            {destacar && (
              <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400">
                Nuevo
              </Badge>
            )}
            {completado && (
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Completado
              </Badge>
            )}
          </div>
          <div className="absolute right-3 bottom-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-110">
            <PlayCircle className="h-7 w-7 fill-primary text-primary" />
          </div>
          <div className="absolute bottom-3 left-3 max-w-[70%]">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
              <GraduationCap className="mr-1 inline h-3 w-3" />
              Curso
            </div>
            <h3 className="text-base font-bold leading-tight text-white drop-shadow">
              {curso.titulo}
            </h3>
          </div>
        </div>

        {/* Meta + progreso */}
        <div className="space-y-2 p-4">
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {curso.descripcion}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {totalLecciones}{" "}
              {totalLecciones === 1 ? "lección" : "lecciones"}
            </span>
            <span>{totalMinutos} min</span>
          </div>
          <div className="space-y-1">
            <Progress value={avancePct} className="h-1.5" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Tu progreso</span>
              <span className="font-semibold">{avancePct}%</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
