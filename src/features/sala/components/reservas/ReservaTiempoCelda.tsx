"use client";

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
      {/* Pasarse del tiempo de mesa se dice con el ROJO y con el "+", que ya
          se ven de un vistazo. El icono de reloj tachado que iba delante solo
          robaba ancho a la cifra, que es el dato, y la dejaba cortada. */}
      <span className="truncate">{t.texto}</span>
    </span>
  );
}
