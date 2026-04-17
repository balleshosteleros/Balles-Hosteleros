"use client";

import { cn } from "@/lib/utils";
import type { TicketLineaConCocina } from "../types";

interface Props {
  linea: TicketLineaConCocina;
  onClick?: (linea: TicketLineaConCocina) => void;
}

export function LineaItem({ linea, onClick }: Props) {
  const destinoLabel =
    linea.destino === "BARRA" ? "🍸" : linea.destino === "COCINA" ? "🍳" : "·";

  const listo = linea.estadoCocina === "LISTO";
  const servido = linea.estadoCocina === "SERVIDO";
  const preparando = linea.estadoCocina === "PREPARANDO";

  return (
    <button
      type="button"
      onClick={() => onClick?.(linea)}
      className={cn(
        "w-full rounded-md border bg-card px-3 py-2 text-left transition-colors",
        "hover:bg-muted/60 active:bg-muted",
        listo && "border-emerald-500/50 bg-emerald-500/5",
        servido && "opacity-60",
        preparando && "border-sky-500/50 bg-sky-500/5",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex flex-1 items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums">{linea.cantidad}</span>
          <span className="text-lg font-semibold leading-tight">{linea.nombre}</span>
        </div>
        <span className="text-xs text-muted-foreground">{destinoLabel}</span>
      </div>
      {linea.notaCocina && (
        <p className="mt-1 truncate text-sm italic text-amber-700 dark:text-amber-400">
          ✎ {linea.notaCocina}
        </p>
      )}
    </button>
  );
}
