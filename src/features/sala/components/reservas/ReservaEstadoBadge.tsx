"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoReserva } from "@/features/sala/data/reservas";
import {
  ESTADO_BADGE_CLASS,
  ESTADO_DOT_CLASS,
  ESTADO_RESERVA_LABELS,
} from "@/features/sala/data/reservas";

// Re-export para callers existentes (no romper imports actuales).
export { ESTADO_BADGE_CLASS, ESTADO_DOT_CLASS };

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
