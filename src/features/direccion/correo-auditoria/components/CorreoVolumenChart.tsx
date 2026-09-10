"use client";

/**
 * Volumen día a día: lo que entra y lo que sale (PRP-094, Fase 3).
 *
 * Barras apiladas por día del periodo. Sirve para ver el pulso: qué días se
 * concentra el correo, si el fin de semana cae, y si lo que sale acompaña a lo
 * que entra o el buzón solo recibe.
 *
 * Los días sin correo llegan con cero y se pintan igual: un hueco en la gráfica
 * y un día tranquilo no son lo mismo.
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { diaCorto, formatoNumero } from "../lib/formato";
import { formatoDiaMesAnio } from "../services/periodos";
import type { DiaDeCorreo } from "../types";

export function CorreoVolumenChart({ serie }: { serie: DiaDeCorreo[] }) {
  if (!serie.length) return null;

  const datos = serie.map((d) => ({
    dia: d.dia,
    etiqueta: diaCorto(d.dia),
    Recibidos: d.entrantes,
    Enviados: d.salientes,
  }));

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 text-sm font-medium">Correo por día</div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="etiqueta"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              // Con un mes entero no caben 31 etiquetas: se dejan las que quepan.
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(valor: number) => formatoNumero(valor)}
              labelFormatter={(_, carga) => {
                const dia = carga?.[0]?.payload?.dia as string | undefined;
                return dia ? formatoDiaMesAnio(dia) : "";
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Recibidos" stackId="correo" fill="#0284c7" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Enviados" stackId="correo" fill="#059669" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
