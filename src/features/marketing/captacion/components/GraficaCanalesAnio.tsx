"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { formatNumero } from "@/shared/lib/numero";
import type { MesCanal } from "../types";
import { CANAL_RESTO, canalesDestacados, filasPorAnio } from "../lib/agregados";

/**
 * Cuántas reservas trajo cada canal, año a año.
 *
 * Barras apiladas y no líneas porque la pregunta es doble: cuánto entró en
 * total ese año (la altura) y de dónde vino (los tramos). Los colores son los
 * del canal en el resto del software (`colorOrigen`), para que el verde de
 * Google sea el mismo aquí que en el listado de reservas.
 *
 * Solo llevan color propio los siete canales que más traen; el resto se apila
 * junto en gris. Ninguno se pierde: la tabla de debajo los lista todos.
 *
 * Entre tramo y tramo hay una separación de 2 px del color del fondo: dos
 * canales de tonos parecidos —el verde de Google y el turquesa de la web— se
 * distinguen por el corte aunque el ojo dude del color.
 */

const COLOR_RESTO = "#94a3b8"; // slate-400, el mismo gris del "sin dato"

interface Props {
  porMes: MesCanal[];
  /** Año que aún no ha terminado: se avisa de que va hasta hoy. */
  anioEnCurso: number;
}

export function GraficaCanalesAnio({ porMes, anioEnCurso }: Props) {
  const destacados = useMemo(() => canalesDestacados(porMes), [porMes]);
  const filas = useMemo(() => filasPorAnio(porMes, destacados), [porMes, destacados]);

  if (filas.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Todavía no hay reservas con canal anotado.
      </div>
    );
  }

  // El montón de canales pequeños va abajo del todo y los grandes encima: así
  // el ojo compara los que importan contra una base que no se mueve.
  const series = [CANAL_RESTO, ...[...destacados].reverse()];

  return (
    <div className="space-y-2">
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis
              dataKey="anio"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatNumero(v)}
              className="text-muted-foreground"
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((s, p) => s + Number(p.value ?? 0), 0);
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                    <p className="mb-1 text-xs font-medium">
                      {label}
                      {Number(label) === anioEnCurso ? " (hasta hoy)" : ""}
                    </p>
                    {[...payload].reverse().map((p) => (
                      <p key={String(p.dataKey)} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="flex-1">{nombreSerie(String(p.dataKey))}</span>
                        <span className="font-medium tabular-nums">
                          {formatNumero(Number(p.value ?? 0))}
                        </span>
                      </p>
                    ))}
                    <p className="mt-1 border-t pt-1 text-xs font-medium">
                      Total {formatNumero(total)}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="square"
              iconSize={10}
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{nombreSerie(value)}</span>
              )}
            />
            {series.map((canal, i) => (
              <Bar
                key={canal}
                dataKey={canal}
                stackId="canales"
                fill={canal === CANAL_RESTO ? COLOR_RESTO : colorOrigen(canal)}
                stroke="hsl(var(--background))"
                strokeWidth={2}
                // Solo el tramo de arriba lleva las esquinas redondeadas.
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        {anioEnCurso} va hasta hoy, así que su barra es más corta por fuerza.
      </p>
    </div>
  );
}

function nombreSerie(clave: string): string {
  return clave === CANAL_RESTO ? "Otros canales" : labelOrigen(clave);
}
