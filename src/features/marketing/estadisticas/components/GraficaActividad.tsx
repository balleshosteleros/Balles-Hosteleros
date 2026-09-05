"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatearFechaEs } from "@/shared/lib/fecha";
import { formatNumero } from "@/shared/lib/numero";
import type { SerieEstadisticas } from "../types";

interface Props {
  datos: SerieEstadisticas;
  /** Cómo se llama lo que se cuenta: "escaneos" en los QR, "visitas" en las webs. */
  unidad: string;
}

/** Etiqueta corta del eje: "6 sep". El eje completo en día/mes/año no cabe con
 *  un mes entero de puntos; la fecha larga sale en el globo al pasar por encima. */
function etiquetaEje(iso: string): string {
  const [, mes, dia] = iso.split("-");
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const indice = Number(mes) - 1;
  if (!dia || indice < 0 || indice > 11) return iso;
  return `${Number(dia)} ${MESES[indice]}`;
}

/** Cuántas etiquetas se saltan para que el eje no se amontone. Con más de un
 *  mes de datos las fechas se solapan y se vuelven ilegibles. */
function saltoEje(puntos: number): number {
  if (puntos <= 10) return 0;
  return Math.max(0, Math.ceil(puntos / 10) - 1);
}

export function GraficaActividad({ datos, unidad }: Props) {
  const serie = datos.serie;

  const filas = useMemo(
    () => serie.map((p) => ({ ...p, etiqueta: etiquetaEje(p.fecha) })),
    [serie],
  );

  if (serie.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Todavía no hay {unidad} en estas fechas.
      </div>
    );
  }

  const sinActividad = datos.total === 0;

  return (
    <div className="space-y-3">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-actividad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={false}
              interval={saltoEje(filas.length)}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const punto = payload[0].payload as { fecha: string; total: number };
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                    <p className="text-xs font-medium">{formatearFechaEs(punto.fecha)}</p>
                    <p className="text-sm">
                      {formatNumero(punto.total)} {unidad}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#grad-actividad)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {sinActividad && (
        <p className="text-center text-xs text-muted-foreground">
          Sin {unidad} en el periodo elegido.
        </p>
      )}
    </div>
  );
}
