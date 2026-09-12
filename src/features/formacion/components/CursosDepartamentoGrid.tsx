"use client";

/**
 * La rejilla de cursos por departamento.
 *
 * Es UNA sola pieza usada desde dos sitios —Formación y la pestaña de Ayuda—
 * porque es lo mismo visto desde distintos sitios. Antes cada pantalla pintaba
 * su propia lista escrita a mano, y ni coincidían entre ellas ni llevaban a
 * ningún curso: solo enlazaban a `/sala`, `/cocina`…
 *
 * Ahora sale de los cursos REALES de la empresa activa (uno por departamento) y
 * cada tarjeta entra en su curso. Están vacíos a propósito hasta que se cargue
 * el temario; mientras tanto lo dicen en vez de aparentar contenido.
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  useFormacionStore,
  cursosVisibles,
  leccionesDeCurso,
} from "../store/use-formacion-store";

interface Props {
  /** Texto bajo el título. Cada pantalla lo dice a su manera. */
  descripcion?: string;
}

export function CursosDepartamentoGrid({
  descripcion = "Pulsa cada departamento para abrirlo y ver cómo funciona.",
}: Props) {
  const { puedeVer, profile } = useAuth();
  const { empresaActual } = useEmpresa();
  const userKey = profile?.email ?? "anon";

  const cursos = useFormacionStore((s) => s.cursos);
  const secciones = useFormacionStore((s) => s.secciones);
  const lecciones = useFormacionStore((s) => s.lecciones);
  const hydrate = useFormacionStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate(userKey);
  }, [hydrate, userKey]);

  const empresaId = empresaActual?.id;
  const visibles = useMemo(() => {
    if (!empresaId) return [];
    return cursosVisibles(cursos, empresaId, null, {
      // Mismo criterio que el menú: no se enseña el temario de un departamento
      // que ese rol no pisa.
      puedeVerDepartamento: (d) => puedeVer(d),
    }).filter((c) => c.ambito === "departamento");
  }, [cursos, empresaId, puedeVer]);

  if (visibles.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpenCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">
          Tu recorrido por los departamentos
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">{descripcion}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map((curso) => {
          const { total } = leccionesDeCurso(secciones, lecciones, curso.id);
          return (
            <Link
              key={curso.id}
              href={`/mi-panel/formacion/curso/${curso.id}`}
              className={cn(
                "group rounded-lg border bg-card p-4 transition-all",
                "hover:border-primary hover:shadow-sm",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Departamento
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {curso.titulo}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {total === 0
                      ? "Sin temario todavía"
                      : `${total} ${total === 1 ? "lección" : "lecciones"}`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
