"use client";

import { cn } from "@/lib/utils";
import type { ColumnaKDS, ComandaAgrupada, TicketLineaConCocina } from "../types";
import { COLUMNA_LABELS } from "../services/clasificador-estados";
import { ComandaCard } from "./ComandaCard";

interface Props {
  columna: ColumnaKDS;
  comandas: ComandaAgrupada[];
  onAvanzar?: (comanda: ComandaAgrupada) => void;
  onRetroceder?: (comanda: ComandaAgrupada) => void;
  onLineaClick?: (linea: TicketLineaConCocina) => void;
}

const COLOR_POR_COLUMNA: Record<ColumnaKDS, string> = {
  PENDIENTE: "bg-slate-500/10 text-slate-900 dark:text-slate-100",
  PREPARANDO: "bg-sky-500/10 text-sky-900 dark:text-sky-100",
  LISTO: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  SERVIDO: "bg-zinc-500/10 text-zinc-900 dark:text-zinc-100",
};

export function ColumnaEstado({
  columna,
  comandas,
  onAvanzar,
  onRetroceder,
  onLineaClick,
}: Props) {
  // Sólo comandas que tienen al menos una línea en esta columna
  const visibles = comandas.filter((c) =>
    c.lineas.some((l) => l.estadoCocina === columna),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex items-center justify-between rounded-t-lg border-b px-4 py-3",
          COLOR_POR_COLUMNA[columna],
        )}
      >
        <h2 className="text-lg font-bold uppercase tracking-wide">
          {COLUMNA_LABELS[columna]}
        </h2>
        <span className="text-sm font-semibold tabular-nums">
          {visibles.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3">
        {visibles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">—</p>
        ) : (
          visibles.map((c) => (
            <ComandaCard
              key={`${c.ticketId}-${columna}`}
              comanda={c}
              columna={columna}
              onAvanzar={onAvanzar}
              onRetroceder={onRetroceder}
              onLineaClick={onLineaClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
