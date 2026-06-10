import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarOff, Clock, Hourglass } from "lucide-react";
import type { HorarioSemana, DiaHorario } from "../lib/mobile-horario-data";

/** "2026-06-09" → "9 jun" (etiqueta corta del rango de semana). */
function fechaCorta(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Texto de los tramos de un día fijo: "08:00–16:00 · 20:00–23:00". */
function tramosTexto(tramos: { inicio: string; fin: string }[]): string {
  return tramos.map((t) => `${t.inicio}–${t.fin}`).join(" · ");
}

function DiaRow({ dia }: { dia: DiaHorario }) {
  const { horario, esHoy } = dia;

  let icono = <CalendarOff className="h-4 w-4 text-muted-foreground/60" />;
  let texto = "Libra";
  let textoClase = "text-muted-foreground";

  if (horario.tipo === "fijo" && horario.tramos.length > 0) {
    icono = <Clock className="h-4 w-4 text-primary" />;
    texto = tramosTexto(horario.tramos);
    textoClase = "text-foreground font-medium";
  } else if (horario.tipo === "flexible") {
    icono = <Hourglass className="h-4 w-4 text-primary" />;
    texto = `${horario.objetivoHoras}h flexibles`;
    textoClase = "text-foreground font-medium";
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
        esHoy ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card"
      }`}
    >
      {/* Día + número */}
      <div className="flex w-12 shrink-0 flex-col items-center">
        <span
          className={`text-[10px] uppercase tracking-wider ${
            esHoy ? "text-primary font-semibold" : "text-muted-foreground"
          }`}
        >
          {dia.diaSemana.slice(0, 3)}
        </span>
        <span
          className={`text-lg leading-none ${
            esHoy ? "text-primary font-bold" : "font-semibold"
          }`}
        >
          {dia.diaNum}
        </span>
      </div>

      {/* Tramos / estado */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0">{icono}</span>
        <span className={`truncate text-sm ${textoClase}`}>{texto}</span>
      </div>

      {esHoy && (
        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          Hoy
        </span>
      )}
    </div>
  );
}

export function HorarioSemanaMobile({
  data,
  offset,
}: {
  data: HorarioSemana;
  offset: number;
}) {
  return (
    <div className="space-y-3">
      {/* Navegador de semana */}
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-2 py-1.5">
        <Link
          href={`/m/horario?semana=${offset - 1}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted active:scale-95"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {fechaCorta(data.lunes)} – {fechaCorta(data.domingo)}
          </p>
          {offset === 0 && (
            <p className="text-[11px] text-muted-foreground">Esta semana</p>
          )}
        </div>
        <Link
          href={`/m/horario?semana=${offset + 1}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted active:scale-95"
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {!data.disponible ? (
        <div className="rounded-2xl border border-border/60 bg-card px-4 py-8 text-center">
          <CalendarOff className="mx-auto h-7 w-7 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">Sin horario asignado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tu horario semanal aparecerá aquí cuando RRHH te asigne un turno o
            patrón.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.dias.map((d) => (
            <DiaRow key={d.fecha} dia={d} />
          ))}
        </div>
      )}
    </div>
  );
}
