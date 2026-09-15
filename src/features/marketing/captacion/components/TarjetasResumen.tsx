"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";

/**
 * Las cuatro cifras de arriba: lo que hay que saber antes de mirar nada más.
 *
 * Cada una lleva su comparación con el MISMO tramo del año pasado, no con el
 * año entero: en septiembre, enfrentar nueve meses contra doce diría que todo
 * cae un tercio sin que haya pasado nada.
 */

export interface Tarjeta {
  etiqueta: string;
  valor: string;
  /** Variación en % frente al mismo tramo del año anterior. `null` = sin comparar. */
  variacion?: number | null;
  /** Texto del pie. Explica de dónde sale la cifra. */
  pie: string;
  /** Cuando subir es MALO (mesas perdidas), la flecha arriba se pinta en rojo. */
  subirEsMalo?: boolean;
}

export function TarjetasResumen({ tarjetas }: { tarjetas: Tarjeta[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tarjetas.map((t) => (
        <Card key={t.etiqueta}>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.etiqueta}
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{t.valor}</span>
              {t.variacion !== undefined && (
                <Variacion valor={t.variacion} subirEsMalo={t.subirEsMalo} />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.pie}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Variacion({
  valor,
  subirEsMalo = false,
}: {
  valor: number | null;
  subirEsMalo?: boolean;
}) {
  if (valor === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" strokeWidth={2} />
        Sin comparar
      </span>
    );
  }
  const sube = valor > 0;
  const plano = Math.abs(valor) < 0.5;
  // El color lo decide si es BUENO o MALO, no si el número sube: más mesas
  // perdidas es peor aunque la flecha apunte hacia arriba.
  const bueno = plano ? null : sube !== subirEsMalo;
  const Icono = plano ? Minus : sube ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        bueno === null && "text-muted-foreground",
        bueno === true && "text-emerald-600",
        bueno === false && "text-red-600",
      )}
    >
      <Icono className="h-3.5 w-3.5" strokeWidth={2} />
      {formatPorcentaje(Math.abs(valor), { max: 1 })}
    </span>
  );
}

/** Cifra con el formato del software (miles con punto). */
export function cifra(n: number): string {
  return formatNumero(n);
}
