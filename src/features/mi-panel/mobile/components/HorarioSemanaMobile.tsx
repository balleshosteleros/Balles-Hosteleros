import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HorarioSemana } from "../lib/mobile-horario-data";
import {
  SemanaHorarioLista,
  rangoSemanaTexto,
} from "@/features/mi-panel/components/SemanaHorarioLista";

/**
 * Su semana en el móvil. La rejilla es la misma pieza que en el ordenador y en
 * la ficha; aquí la semana se cambia con enlaces, que no necesitan JavaScript.
 */
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
          <p className="text-sm font-semibold">{rangoSemanaTexto(data.lunes, data.domingo)}</p>
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

      <SemanaHorarioLista
        data={data}
        textoSinHorario="Tu horario semanal aparecerá aquí cuando RRHH te asigne un turno o patrón."
      />
    </div>
  );
}
