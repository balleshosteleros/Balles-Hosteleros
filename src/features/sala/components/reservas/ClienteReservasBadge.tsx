"use client";

import { cn } from "@/lib/utils";

/**
 * Recuadro azul con las veces que ese cliente ha reservado en la empresa.
 *
 * Solo aparece a partir de la SEGUNDA reserva: si es la primera vez que
 * reserva no hay nada que destacar, y un "1" en cada fila de gente nueva sería
 * ruido. A partir de 2 el número dice de un vistazo que quien llega es un
 * cliente habitual.
 */
export function ClienteReservasBadge({
  total,
  className,
}: {
  total: number | undefined;
  className?: string;
}) {
  if (!total || total < 2) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border px-1",
        "border-blue-500/40 bg-blue-500/10 text-[10px] font-semibold tabular-nums text-blue-600",
        "[.sala-oscuro_&]:text-blue-300",
        className,
      )}
      title={`Ha venido ${total} veces`}
    >
      {total}
    </span>
  );
}
