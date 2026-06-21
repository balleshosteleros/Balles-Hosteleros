import Image from "next/image";
import Link from "next/link";
import type { EmpresaPublica } from "../services/empleo-fetch";

export function EmpleoBrandingShell({
  empresa,
  children,
}: {
  empresa: EmpresaPublica;
  children: React.ReactNode;
}) {
  const colorPrimario = empresa.color ?? "hsl(220 80% 55%)";
  const colorTexto = empresa.color_texto ?? "#ffffff";

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={
        {
          "--brand-primary": colorPrimario,
          "--brand-text": colorTexto,
        } as React.CSSProperties
      }
    >
      <header
        className="w-full border-b border-border/50 sticky top-0 z-30 backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--brand-primary) 12%, var(--background))" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/empleo/${empresa.empleo_slug}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {empresa.logo_url ? (
              <div className="relative h-10 w-10 rounded-md overflow-hidden bg-white/80 shadow-sm">
                <Image
                  src={empresa.logo_url}
                  alt={empresa.nombre}
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                />
              </div>
            ) : (
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center font-bold text-sm"
                style={{ background: "var(--brand-primary)", color: "var(--brand-text)" }}
              >
                {empresa.nombre.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="leading-tight">
              <div
                className="text-base font-semibold"
                style={{ color: "var(--brand-primary)" }}
              >
                {empresa.nombre}
              </div>
              <div className="text-[11px] text-muted-foreground">Empleo · Únete al equipo</div>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">{children}</div>
      </main>

      <footer className="border-t border-border/50 py-4 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          {empresa.nombre} · Portal de empleo
        </div>
      </footer>
    </div>
  );
}
