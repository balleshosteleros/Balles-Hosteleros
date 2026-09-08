import Image from "next/image";
import Link from "next/link";
import { CalendarDays, GraduationCap, LogOut, UserRound } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { salirDeLaEscuela } from "../../actions/portal-actions";
import type { MarcaEscuela } from "../../services/portal-alumno";

/**
 * Marco del portal del alumno: marca arriba y tres sitios donde ir.
 *
 * Los colores salen SIEMPRE de Ajustes → Imagen de marca y se reparten como
 * variables CSS, para que ningún componente de dentro lleve un color escrito a
 * mano.
 */

const SECCIONES = [
  { href: "/escuela", etiqueta: "Clases", icono: CalendarDays },
  { href: "/escuela/cursos", etiqueta: "Cursos", icono: GraduationCap },
  { href: "/escuela/perfil", etiqueta: "Mi perfil", icono: UserRound },
] as const;

export function PortalShell({
  marca,
  activa,
  nombreAlumno,
  children,
}: {
  marca: MarcaEscuela;
  activa: "clases" | "cursos" | "perfil";
  nombreAlumno?: string;
  children: React.ReactNode;
}) {
  const indice = { clases: 0, cursos: 1, perfil: 2 }[activa];

  return (
    <div
      className="min-h-screen bg-muted/30"
      style={
        {
          "--marca-primario": marca.color,
          "--marca-secundario": marca.colorSecundario,
          "--marca-texto": marca.colorTexto,
        } as React.CSSProperties
      }
    >
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/escuela" className="flex items-center gap-2.5 min-w-0">
            {marca.isotipoUrl || marca.logoUrl ? (
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5">
                <Image
                  src={(marca.isotipoUrl || marca.logoUrl) as string}
                  alt={marca.nombre}
                  fill
                  sizes="36px"
                  className="object-contain p-1"
                />
              </span>
            ) : (
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold"
                style={{ background: "var(--marca-primario)", color: "var(--marca-texto)" }}
              >
                {marca.nombre.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-semibold sm:text-base">
              Escuela {marca.nombre}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {nombreAlumno ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{nombreAlumno}</span>
            ) : null}
            <form action={salirDeLaEscuela}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 px-2">
          {SECCIONES.map((s, i) => {
            const Icono = s.icono;
            const esActiva = i === indice;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  esActiva
                    ? "text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                style={esActiva ? { borderColor: "var(--marca-primario)" } : undefined}
              >
                <Icono className="h-4 w-4" />
                {s.etiqueta}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
