"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  ClipboardList,
  GraduationCap,
  Megaphone,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useFormacionStore,
  novedadesActivas,
} from "../store/use-formacion-store";
import type { Puesto, TipoNovedad } from "../types";

const TIPO_META: Record<
  TipoNovedad,
  { label: string; icon: typeof Bell; color: string }
> = {
  tarea: {
    label: "Tarea",
    icon: ClipboardList,
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  leccion: {
    label: "Lección nueva",
    icon: PlayCircle,
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  curso: {
    label: "Curso nuevo",
    icon: GraduationCap,
    color: "bg-violet-100 text-violet-800 border-violet-200",
  },
  cambio: {
    label: "Cambio",
    icon: RefreshCw,
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  aviso: {
    label: "Aviso",
    icon: Megaphone,
    color: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  empresaId: string;
  puesto: Puesto | null;
}

export function NovedadesPanel({ empresaId, puesto }: Props) {
  const novedades = useFormacionStore((s) => s.novedades);
  const items = useMemo(
    () => novedadesActivas(novedades, empresaId, puesto),
    [novedades, empresaId, puesto],
  );

  return (
    <Card className="border-blue-600/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            <h2 className="text-base font-semibold text-foreground">
              Novedades de los últimos 3 meses
            </h2>
          </div>
          <Badge variant="secondary" className="text-[11px]">
            {items.length} {items.length === 1 ? "novedad" : "novedades"}
          </Badge>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay novedades en los últimos 3 meses para tu puesto.
          </p>
        ) : (
          <ScrollArea className="max-h-[340px] pr-2">
            <ul className="space-y-2">
              {items.map((n) => {
                const meta = TIPO_META[n.tipo];
                const Icon = meta.icon;
                const audiencia =
                  n.audiencia === "todos"
                    ? "Todo el equipo"
                    : n.audiencia.join(" · ");
                const enlace = n.cursoId
                  ? `/mi-panel/formacion/curso/${n.cursoId}${
                      n.leccionId ? `?leccion=${n.leccionId}` : ""
                    }`
                  : null;
                return (
                  <li
                    key={n.id}
                    className="rounded-lg border border-border bg-card p-3 transition hover:border-blue-300 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`shrink-0 rounded-md border p-1.5 ${meta.color}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {meta.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            · {formatFecha(n.fechaPublicacion)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            · {n.autor}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {n.titulo}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {n.descripcion}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            Para: {audiencia}
                          </span>
                          {enlace && (
                            <Link
                              href={enlace}
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              {n.leccionId ? "Ver lección →" : "Abrir curso →"}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
