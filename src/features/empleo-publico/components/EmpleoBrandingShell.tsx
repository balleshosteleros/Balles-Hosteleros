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
  const colorSecundario = empresa.color_secundario ?? colorPrimario;
  const colorTexto = empresa.color_texto ?? "#ffffff";

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden bg-background"
      style={
        {
          "--brand-primary": colorPrimario,
          "--brand-secondary": colorSecundario,
          "--brand-text": colorTexto,
        } as React.CSSProperties
      }
    >
      {/* Fondo difuminado con el color de marca */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-[20%] left-1/2 -translate-x-1/2 h-[70vh] w-[90vh] rounded-full blur-[120px] opacity-30"
          style={{ background: "var(--brand-primary)" }}
        />
        <div
          className="absolute -bottom-[15%] -right-[10%] h-[55vh] w-[55vh] rounded-full blur-[120px] opacity-20"
          style={{ background: "var(--brand-secondary)" }}
        />
        <div
          className="absolute -bottom-[10%] -left-[10%] h-[45vh] w-[45vh] rounded-full blur-[120px] opacity-15"
          style={{ background: "var(--brand-primary)" }}
        />
      </div>

      {/* Cabecera con isotipo centrado (sin logo arriba a la izquierda) */}
      <header className="w-full">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2 md:pt-14 flex flex-col items-center text-center gap-3">
          <Link
            href={`/empleo/${empresa.empleo_slug}`}
            className="flex flex-col items-center gap-3 hover:opacity-90 transition-opacity"
          >
            {empresa.logo_url ? (
              <div className="relative h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden bg-white shadow-lg ring-1 ring-black/5">
                <Image
                  src={empresa.logo_url}
                  alt={empresa.nombre}
                  fill
                  sizes="96px"
                  className="object-contain p-2"
                />
              </div>
            ) : (
              <div
                className="h-20 w-20 md:h-24 md:w-24 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg"
                style={{ background: "var(--brand-primary)", color: "var(--brand-text)" }}
              >
                {empresa.nombre.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="leading-tight">
              <div
                className="text-xl md:text-2xl font-bold"
                style={{ color: "var(--brand-primary)" }}
              >
                {empresa.nombre}
              </div>
              <div className="text-xs text-muted-foreground">Empleo · Únete al equipo</div>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">{children}</div>
      </main>

      <footer className="border-t border-border/40 py-4 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          {empresa.nombre} · Portal de empleo
        </div>
      </footer>
    </div>
  );
}
