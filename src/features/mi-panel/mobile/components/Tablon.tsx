import Link from "next/link";
import { Trophy, Zap, Megaphone, Users, ChevronRight } from "lucide-react";
import type { MobileHomeData } from "../lib/mobile-home-data";

interface Props {
  data: MobileHomeData;
}

export function Tablon({ data }: Props) {
  const { resumen, comunicadosRecientes, cumpleEstaSemana } = data;

  const teTocaItems: Array<{ label: string; href: string }> = [];
  if (resumen.cuestionarios.pendientes > 0) {
    teTocaItems.push({
      label: `${resumen.cuestionarios.pendientes} cuestionario${resumen.cuestionarios.pendientes === 1 ? "" : "s"} pendiente${resumen.cuestionarios.pendientes === 1 ? "" : "s"}`,
      href: "/m/cuestionarios",
    });
  }
  const cursosPendientes =
    resumen.formacion.cursosAsignados - resumen.formacion.cursosCompletados;
  if (cursosPendientes > 0) {
    teTocaItems.push({
      label: `${cursosPendientes} curso${cursosPendientes === 1 ? "" : "s"} sin terminar`,
      href: "/m/formacion",
    });
  }

  const hayActividadSemana =
    resumen.fichajes.mesHoras > 0 ||
    resumen.points.acumulados > 0 ||
    resumen.fichajes.mesCount > 0;

  return (
    <div className="space-y-3 px-5 pt-5">
      {hayActividadSemana && (
        <Section title="Tu mes" icon={Trophy}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Horas" value={resumen.fichajes.mesHoras.toFixed(0)} />
            <Stat label="Turnos" value={resumen.fichajes.mesCount.toString()} />
            <Stat label="Points" value={resumen.points.acumulados.toString()} />
          </div>
          {resumen.points.nivelNombre && (
            <p className="mt-2 text-xs text-muted-foreground">
              Nivel{" "}
              <span className="font-medium text-foreground">{resumen.points.nivelNombre}</span>
              {resumen.points.siguienteNombre && resumen.points.faltan > 0 && (
                <> · te faltan {resumen.points.faltan} para {resumen.points.siguienteNombre}</>
              )}
            </p>
          )}
        </Section>
      )}

      {teTocaItems.length > 0 && (
        <Section title="Te toca a ti" icon={Zap}>
          <ul className="divide-y divide-border/60">
            {teTocaItems.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm active:opacity-70"
                >
                  <span>{it.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {comunicadosRecientes.length > 0 && (
        <Section title="Novedades" icon={Megaphone}>
          <ul className="space-y-2.5">
            {comunicadosRecientes.map((c) => (
              <li key={c.id}>
                <Link
                  href="/m/comunicados"
                  className="block rounded-lg active:opacity-70"
                >
                  <p className="line-clamp-1 text-sm font-medium">{c.titulo}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {c.contenido}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {cumpleEstaSemana.length > 0 && (
        <Section title="Tu equipo" icon={Users}>
          <ul className="space-y-1.5 text-sm">
            {cumpleEstaSemana.map((c) => (
              <li key={c.nombre} className="flex items-center justify-between gap-3">
                <span className="truncate">🎂 {c.nombre}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.diasRestantes === 0
                    ? "hoy"
                    : c.diasRestantes === 1
                      ? "mañana"
                      : `${c.fechaTexto} · en ${c.diasRestantes}d`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* TileNoOlvides — conectado en Fase 4 con vencimientos reales */}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Trophy;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
      <p className="text-2xl font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
