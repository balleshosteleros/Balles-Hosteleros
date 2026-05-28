"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoReserva } from "@/features/sala/data/reservas";
import { ESTADO_RESERVA_LABELS } from "@/features/sala/data/reservas";

/**
 * Paleta de estados estilo CoverManager. Cada estado tiene una clase para
 * Badge (chip) y otra para el dot/punto (sólido). Mantener sincronizado con
 * los Records de `ReservasView.tsx`.
 */
export const ESTADO_BADGE_CLASS: Record<EstadoReserva, string> = {
  CONFIRMADA:             "bg-emerald-600/20 text-emerald-400 border-emerald-600/40",
  PENDIENTE:              "bg-amber-600/20 text-amber-400 border-amber-600/40",
  RECONFIRMADA:           "bg-sky-600/20 text-sky-400 border-sky-600/40",
  LISTA_ESPERA:           "bg-violet-600/20 text-violet-400 border-violet-600/40",
  WALK_IN:                "bg-orange-600/20 text-orange-300 border-orange-600/40",
  LLEGADA:                "bg-blue-600/20 text-blue-400 border-blue-600/40",
  NO_SHOW:                "bg-red-600/20 text-red-400 border-red-600/40",
  COMPLETADA:             "bg-muted text-muted-foreground border-border",
  CANCELADA:              "bg-red-900/20 text-red-500 border-red-800/40",
  TARJETA_NO_INTRODUCIDA: "bg-zinc-100 text-zinc-800 border-zinc-300",
  LLEGADA_BARRA:          "bg-purple-600/20 text-purple-300 border-purple-600/40",
  SENTADA:                "bg-green-700/20 text-green-300 border-green-700/40",
  POSTRE:                 "bg-cyan-600/20 text-cyan-300 border-cyan-600/40",
  CUENTA_SOLICITADA:      "bg-blue-700/20 text-blue-300 border-blue-700/40",
  LIMPIAR:                "bg-lime-600/20 text-lime-300 border-lime-600/40",
  LIBERADA:               "bg-yellow-600/20 text-yellow-300 border-yellow-600/40",
  A_REVISAR:              "bg-rose-600/20 text-rose-300 border-rose-600/40",
};

export const ESTADO_DOT_CLASS: Record<EstadoReserva, string> = {
  CONFIRMADA:             "bg-emerald-500",
  PENDIENTE:              "bg-amber-500",
  RECONFIRMADA:           "bg-sky-500",
  LISTA_ESPERA:           "bg-violet-500",
  WALK_IN:                "bg-orange-400",
  LLEGADA:                "bg-blue-500",
  NO_SHOW:                "bg-red-500",
  COMPLETADA:             "bg-muted-foreground",
  CANCELADA:              "bg-red-800",
  TARJETA_NO_INTRODUCIDA: "bg-zinc-400",
  LLEGADA_BARRA:          "bg-purple-500",
  SENTADA:                "bg-green-600",
  POSTRE:                 "bg-cyan-500",
  CUENTA_SOLICITADA:      "bg-blue-700",
  LIMPIAR:                "bg-lime-500",
  LIBERADA:               "bg-yellow-500",
  A_REVISAR:              "bg-rose-500",
};

interface BadgeProps {
  estado: EstadoReserva;
  className?: string;
}

export function ReservaEstadoBadge({ estado, className }: BadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(ESTADO_BADGE_CLASS[estado], "text-[10px] font-medium", className)}
    >
      {ESTADO_RESERVA_LABELS[estado]}
    </Badge>
  );
}

export function ReservaEstadoDot({ estado, className }: BadgeProps) {
  return (
    <span className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", ESTADO_DOT_CLASS[estado], className)} />
  );
}
