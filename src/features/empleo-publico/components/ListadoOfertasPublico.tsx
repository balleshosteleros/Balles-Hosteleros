import Link from "next/link";
import { MapPin, Clock, Briefcase, ChevronRight, Utensils, Building2 } from "lucide-react";
import type { EmpleoPortal, OfertaPublica } from "../services/empleo-fetch";

const JORNADA_LABEL: Record<string, string> = {
  completa: "Jornada completa",
  parcial: "Jornada parcial",
  rotativa: "Rotativa",
  fines_de_semana: "Fines de semana",
  extra: "Horas extra",
};

/** Las vacantes sin área asignada se muestran en la columna operativa. */
function ordenarPorOrden(a: OfertaPublica, b: OfertaPublica): number {
  const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
  const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return a.fecha_creacion < b.fecha_creacion ? 1 : -1;
}

function OfertaCard({ o, empleoSlug }: { o: OfertaPublica; empleoSlug: string }) {
  return (
    <Link
      href={`/empleo/${empleoSlug}/${o.id}`}
      className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 md:p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--brand-primary)] active:scale-[0.99]"
    >
      {/* Relleno con el color de marca al pulsar la vacante */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-[0.06] group-active:opacity-100"
        style={{ background: "var(--brand-primary)" }}
      />
      <div className="relative flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg md:text-xl font-semibold transition-colors group-hover:text-[var(--brand-primary)] group-active:text-[var(--brand-text)]">
            {o.titulo}
          </h3>
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
  );
}

function ColumnaArea({
  titulo,
  icono,
  ofertas,
  empleoSlug,
}: {
  titulo: string;
  icono: React.ReactNode;
  ofertas: OfertaPublica[];
  empleoSlug: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--brand-primary)]"
          style={{ background: "color-mix(in srgb, var(--brand-primary) 12%, transparent)" }}
        >
          {icono}
        </span>
        <h2 className="text-sm font-bold text-foreground/80">{titulo}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{ofertas.length}</span>
      </div>

      {ofertas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center text-sm text-muted-foreground">
          Sin vacantes en esta área
        </div>
      ) : (
        <div className="grid gap-3">
          {ofertas.map((o) => (
            <OfertaCard key={o.id} o={o} empleoSlug={empleoSlug} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ListadoOfertasPublico({ portal }: { portal: EmpleoPortal }) {
  const { empresa, ofertas } = portal;
  const empleoSlug = empresa.empleo_slug;

  // Las administrativas a su columna; el resto (operativas o sin área) a operativa.
  const administrativas = ofertas
    .filter((o) => o.area === "ADMINISTRATIVA")
    .sort(ordenarPorOrden);
  const operativas = ofertas
    .filter((o) => o.area !== "ADMINISTRATIVA")
    .sort(ordenarPorOrden);

  return (
    <div className="space-y-8">
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
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <ColumnaArea
            titulo="Área operativa"
            icono={<Utensils className="h-4 w-4" />}
            ofertas={operativas}
            empleoSlug={empleoSlug}
          />
          <ColumnaArea
            titulo="Área administrativa"
            icono={<Building2 className="h-4 w-4" />}
            ofertas={administrativas}
            empleoSlug={empleoSlug}
          />
        </div>
      )}
    </div>
  );
}
