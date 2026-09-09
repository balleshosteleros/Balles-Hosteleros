import Image from "next/image";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import type { CursoPortal } from "../../services/portal-alumno";

/**
 * Rejilla de cursos del alumno con lo que lleva hecho de cada uno.
 *
 * Cada tarjeta lleva a su curso. Aquí no se edita nada: los cursos se montan en
 * el back-office de la escuela.
 */
export function CursosAlumno({ cursos }: { cursos: CursoPortal[] }) {
  if (!cursos.length) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <GraduationCap className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Todavía no tienes ningún curso disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cursos.map((c) => {
        const porcentaje = c.totalLecciones
          ? Math.round((c.completadas / c.totalLecciones) * 100)
          : 0;
        // Una portada puede ser una imagen o un degradado guardado como texto.
        const esImagen = !!c.cover && /^https?:\/\//.test(c.cover);
        // Un curso anunciado se ve, pero no se abre: dentro no hay nada
        // todavía y entrar en él solo decepciona.
        const tarjeta = (
          <>
            <div
              className="relative aspect-video w-full bg-muted"
              style={
                !esImagen
                  ? {
                      background:
                        c.cover ||
                        "linear-gradient(135deg, var(--marca-primario) 0%, color-mix(in srgb, var(--marca-primario) 55%, #000) 100%)",
                    }
                  : undefined
              }
            >
              {esImagen ? (
                <Image
                  src={c.cover as string}
                  alt={c.titulo}
                  fill
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="object-cover"
                />
              ) : null}
              {c.proximamente ? (
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-2 text-center text-xs font-semibold uppercase tracking-widest text-white">
                  Próximamente
                </span>
              ) : null}
            </div>
            <div className="space-y-2 p-4">
              <h3 className="font-semibold leading-tight">{c.titulo}</h3>
              {c.descripcion ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">{c.descripcion}</p>
              ) : null}
              {c.proximamente ? null : (
              <div className="pt-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${porcentaje}%`, background: "var(--marca-primario)" }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {c.completadas} de {c.totalLecciones} lecciones · {porcentaje}%
                </p>
              </div>
              )}
            </div>
          </>
        );

        if (c.proximamente) {
          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-2xl border bg-background opacity-90"
            >
              {tarjeta}
            </div>
          );
        }

        return (
          <Link
            key={c.id}
            href={`/escuela/cursos/${c.id}`}
            className="group overflow-hidden rounded-2xl border bg-background transition-shadow hover:shadow-md"
          >
            {tarjeta}
          </Link>
        );
      })}
    </div>
  );
}
