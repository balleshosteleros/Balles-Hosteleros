"use client";

import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import { cn } from "@/lib/utils";
import type { CalidadCanal } from "../types";

/**
 * Qué canal trae buena reserva y cuál no, en los últimos dos años.
 *
 * Las dos formas de perder una mesa se enseñan SEPARADAS a propósito. Una
 * cancelación avisa y deja tiempo de revender; un no show deja la mesa muerta
 * esa noche. Sumarlas en un solo número escondería justo la diferencia que
 * decide si hay que pedir tarjeta o reconfirmar.
 *
 * Solo salen los canales con 30 reservas o más: por debajo, un porcentaje sobre
 * cuatro reservas no dice nada y solo sirve para asustar.
 */

const MINIMO_RESERVAS = 30;

export function TablaCalidad({ calidad }: { calidad: CalidadCanal[] }) {
  const filas = calidad.filter((c) => c.reservas >= MINIMO_RESERVAS);
  if (filas.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        Todavía no hay reservas suficientes en los últimos dos años.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <th className="p-3 text-left font-medium">Canal</th>
            <th className="p-3 text-right font-medium">Reservas</th>
            <th className="p-3 text-right font-medium">Mesa de</th>
            <th className="p-3 text-right font-medium">Cancelan</th>
            <th className="p-3 text-right font-medium">No aparecen</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => {
            const pctCancela = (c.canceladas / c.reservas) * 100;
            const pctNoShow = (c.noShow / c.reservas) * 100;
            return (
              <tr key={c.canal} className="border-b last:border-0">
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: colorOrigen(c.canal) }}
                    />
                    {labelOrigen(c.canal)}
                  </span>
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatNumero(c.reservas)}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatNumero(c.mediaPersonas, { min: 1, max: 1 })} personas
                </td>
                <td className="p-3 text-right tabular-nums text-muted-foreground">
                  {formatPorcentaje(pctCancela, { max: 1 })}
                </td>
                <td
                  className={cn(
                    "p-3 text-right font-medium tabular-nums",
                    pctNoShow >= 8 && "text-red-600",
                    pctNoShow >= 4 && pctNoShow < 8 && "text-amber-600",
                    pctNoShow < 4 && "text-muted-foreground",
                  )}
                >
                  {formatPorcentaje(pctNoShow, { max: 1 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Últimos dos años. Cancelar avisa y deja revender la mesa; no aparecer la deja
        vacía esa noche.
      </p>
    </div>
  );
}
