"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { formatNumero } from "@/shared/lib/numero";
import type { MesCanal } from "../types";
import { aniosConDatos, canalesDestacados } from "../lib/agregados";

/**
 * Qué canal sube y cuál baja, año a año.
 *
 * La gráfica apilada de al lado dice cuánto entró en total; esta dice qué le
 * pasa a cada canal por separado, que es lo que se mira para decidir dónde
 * meter el dinero.
 *
 * Un año sin ninguna reserva de ese canal deja HUECO, no un cero. No es lo
 * mismo "ese año no vino nadie por ahí" que "ese año todavía no se anotaba":
 * el walk-in, por ejemplo, no se registró hasta 2025, y una línea bajando a
 * cero diría una mentira sobre los años anteriores.
 */

interface Props {
  porMes: MesCanal[];
  anioEnCurso: number;
}

export function GraficaTendenciaCanales({ porMes, anioEnCurso }: Props) {
  const destacados = useMemo(() => canalesDestacados(porMes), [porMes]);
  const anios = useMemo(() => aniosConDatos(porMes), [porMes]);

  const filas = useMemo(() => {
    const acc = new Map<number, Record<string, number>>();
    for (const m of porMes) {
      if (!destacados.includes(m.canal)) continue;
      const fila = acc.get(m.anio) ?? {};
      fila[m.canal] = (fila[m.canal] ?? 0) + m.reservas;
      acc.set(m.anio, fila);
    }
    return anios.map((anio) => ({ anio: String(anio), ...(acc.get(anio) ?? {}) }));
  }, [porMes, destacados, anios]);

  if (filas.length < 2) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Hace falta más de un año de historia para ver la tendencia.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filas} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
              cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const orden = [...payload].sort(
                  (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
                );
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                    <p className="mb-1 text-xs font-medium">
                      {label}
                      {Number(label) === anioEnCurso ? " (hasta hoy)" : ""}
                    </p>
                    {orden.map((p) => (
                      <p key={String(p.dataKey)} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="flex-1">{labelOrigen(String(p.dataKey))}</span>
                        <span className="font-medium tabular-nums">
                          {formatNumero(Number(p.value ?? 0))}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="plainline"
              iconSize={14}
              formatter={(value: string) => (
                <span className="text-xs text-muted-foreground">{labelOrigen(value)}</span>
              )}
            />
            {destacados.map((canal) => (
              <Line
                key={canal}
                type="monotone"
                dataKey={canal}
                stroke={colorOrigen(canal)}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: colorOrigen(canal) }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        Un canal sin línea en un año es que ese año no se anotó nada por ahí. El walk
        in, por ejemplo, no empezó a registrarse hasta 2025.
      </p>
    </div>
  );
}
