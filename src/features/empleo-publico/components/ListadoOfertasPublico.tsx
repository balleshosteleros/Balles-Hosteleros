import Link from "next/link";
import { MapPin, Clock, Briefcase, ChevronRight } from "lucide-react";
import type { EmpleoPortal } from "../services/empleo-fetch";

const JORNADA_LABEL: Record<string, string> = {
  completa: "Jornada completa",
  parcial: "Jornada parcial",
  rotativa: "Rotativa",
  fines_de_semana: "Fines de semana",
  extra: "Horas extra",
};

export function ListadoOfertasPublico({ portal }: { portal: EmpleoPortal }) {
  const { empresa, ofertas } = portal;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Ofertas de empleo en{" "}
          <span style={{ color: "var(--brand-primary)" }}>{empresa.nombre}</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          {ofertas.length === 0
            ? "Ahora mismo no hay ofertas activas. ¡Vuelve pronto!"
            : `${ofertas.length} ${ofertas.length === 1 ? "oferta abierta" : "ofertas abiertas"}`}
        </p>
      </div>

      {ofertas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 py-16 text-center text-muted-foreground">
          <Briefcase className="h-10 w-10 mx-auto opacity-40 mb-2" />
          <p>No tenemos vacantes publicadas en este momento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {ofertas.map((o) => (
            <Link
              key={o.id}
              href={`/empleo/${empresa.empleo_slug}/${o.id}`}
              className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 md:p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--brand-primary)] active:scale-[0.99]"
            >
              {/* Relleno con el color de marca al pulsar la vacante */}
              <span
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-[0.06] group-active:opacity-100"
                style={{ background: "var(--brand-primary)" }}
              />
              <div className="relative flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-xl font-semibold transition-colors group-hover:text-[var(--brand-primary)] group-active:text-[var(--brand-text)]">
                    {o.titulo}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground transition-colors group-active:text-[var(--brand-text)]/85">
                    {(o.departamento_nombre || o.categoria) && (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {o.departamento_nombre ?? o.categoria}
                      </span>
                    )}
                    {o.ubicacion && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {o.ubicacion}
                      </span>
                    )}
                    {o.tipo_jornada && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {JORNADA_LABEL[o.tipo_jornada] ?? o.tipo_jornada}
                      </span>
                    )}
                  </div>
                  {o.descripcion && (
                    <p className="mt-3 text-sm text-foreground/80 line-clamp-2 transition-colors group-active:text-[var(--brand-text)]/85">
                      {o.descripcion}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-1 group-active:text-[var(--brand-text)]" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
