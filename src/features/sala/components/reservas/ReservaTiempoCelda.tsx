"use client";

import { TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Reserva } from "@/features/sala/data/reservas";
import {
  TIEMPO_FASE_CLASS,
  calcularTiempoReserva,
} from "@/features/sala/lib/reserva-tiempo";

/**
 * Celda de la columna TIEMPO del listado de reservas.
 *
 * No guarda nada: recibe el "ahora" de la empresa y recalcula en cada render a
 * partir de la fecha, la hora, la duración y el estado ACTUALES de la reserva.
 * Por eso mover una reserva de día o de hora reinicia el contador solo, sin
 * arrastrar el horario anterior.
 */
export function ReservaTiempoCelda({
  reserva,
  ahora,
  duracionEmpresaMin,
  className,
}: {
  reserva: Reserva;
  /** Fecha y minutos del día en la zona horaria de la empresa. */
  ahora: { fecha: string; minutos: number };
  duracionEmpresaMin: number | null | undefined;
  className?: string;
}) {
  const t = calcularTiempoReserva(reserva, ahora, duracionEmpresaMin);
  if (!t) return <span className={cn("min-w-0", className)} />;

  return (
    <span
      className={cn(
        "flex min-w-0 items-center justify-center gap-0.5 tabular-nums font-semibold text-[13px]",
        TIEMPO_FASE_CLASS[t.fase],
        className,
      )}
      title={t.detalle}
    >
      {/* Pasada la duración prevista aparece el icono junto a la hora: la mesa
          ya debería estar libre y eso hay que verlo sin leer el número. */}
      {t.fase === "EXCEDIDA" && (
        <TimerOff className="size-3 shrink-0" aria-label="Tiempo de mesa superado" />
      )}
      <span className="truncate">{t.texto}</span>
    </span>
  );
}
