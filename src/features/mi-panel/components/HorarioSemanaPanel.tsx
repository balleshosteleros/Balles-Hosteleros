"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getMiSemanaHorario,
  getSemanaHorarioEmpleado,
} from "@/features/mi-panel/actions/horario-semana-actions";
import type { HorarioSemana } from "@/features/mi-panel/mobile/lib/mobile-horario-data";
import {
  SemanaHorarioLista,
  rangoSemanaTexto,
} from "@/features/mi-panel/components/SemanaHorarioLista";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

/**
 * Su semana de horario en el ordenador, con flechas para ir a la anterior o la
 * siguiente. Sin `empleadoId` es la del trabajador que mira su propio panel;
 * con él, la del empleado cuya ficha está abierta RRHH: los dos leen lo mismo.
 */
export function HorarioSemanaPanel({ empleadoId }: { empleadoId?: string }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<HorarioSemana | null>(null);
  const [cargando, setCargando] = useState(true);
  useGlobalLoadingSync(cargando);

  const cargar = useCallback(
    async (off: number) => {
      setCargando(true);
      try {
        const res = empleadoId
          ? await getSemanaHorarioEmpleado(empleadoId, off)
          : await getMiSemanaHorario(off);
        setData(res);
      } finally {
        setCargando(false);
      }
    },
    [empleadoId],
  );

  useEffect(() => {
    void cargar(offset);
  }, [cargar, offset]);

  if (!data) return <LoadingSpinner className="py-16" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{rangoSemanaTexto(data.lunes, data.domingo)}</p>
          <p className="text-[11px] text-muted-foreground">
            {offset === 0 ? "Esta semana" : cargando ? "Cargando…" : " "}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <SemanaHorarioLista
        data={data}
        textoSinHorario={
          empleadoId
            ? "Su horario semanal aparecerá aquí cuando se le asigne un turno o un patrón."
            : "Tu horario semanal aparecerá aquí cuando RRHH te asigne un turno o patrón."
        }
      />
    </div>
  );
}
