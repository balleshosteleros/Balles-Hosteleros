"use client";

import { cn } from "@/lib/utils";
import { formatPorcentaje } from "@/shared/lib/numero";
import { CIFRA, TITULAR } from "../lib/estilo";

/**
 * Las cuatro cifras de arriba: lo que hay que saber antes de mirar nada más.
 *
 * Van en una sola rejilla con una línea de un píxel entre celda y celda, no
 * como cuatro tarjetas sueltas: son cuatro caras del mismo año, y separarlas en
 * cuatro objetos las haría parecer cuatro asuntos distintos.
 *
 * Cada una lleva su comparación con el MISMO tramo del año pasado: en
 * septiembre, enfrentar nueve meses contra doce diría que todo cae un tercio
 * sin que haya pasado nada.
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
    <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {tarjetas.map((t) => (
        <div key={t.etiqueta} className="bg-card px-5 pb-5 pt-4">
          <p
            className="text-[.72rem] font-medium uppercase tracking-[.09em] text-muted-foreground"
            style={TITULAR}
          >
            {t.etiqueta}
          </p>
          <p
            className="mt-2 flex items-baseline gap-2 text-[2.1rem] font-bold leading-tight tracking-tight"
            style={TITULAR}
          >
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{t.valor}</span>
            {t.variacion !== undefined && (
              <Variacion valor={t.variacion} subirEsMalo={t.subirEsMalo} />
            )}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">{t.pie}</p>
        </div>
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
  if (valor === null) return null;

  const plano = Math.abs(valor) < 0.5;
  // El color lo decide si es BUENO o MALO, no si el número sube: más mesas
  // perdidas es peor aunque la cifra crezca.
  const bueno = plano ? null : valor > 0 !== subirEsMalo;

  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[.8rem] font-medium",
        bueno === null && "bg-muted text-muted-foreground",
        bueno === true && "bg-emerald-500/10 text-emerald-600",
        bueno === false && "bg-red-500/10 text-red-600",
      )}
      style={CIFRA}
    >
      {valor > 0 ? "+" : ""}
      {formatPorcentaje(valor, { max: 1 })}
    </span>
  );
}
