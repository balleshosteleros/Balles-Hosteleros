"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { CIFRA, TITULAR } from "../lib/estilo";
import { formatNumero, formatPorcentaje } from "@/shared/lib/numero";
import type { MesCanal } from "../types";
import {
  aniosConDatos,
  compararMismoTramo,
  rankingCanales,
  reservasPorCanalYAnio,
  variacion,
} from "../lib/agregados";

/**
 * Todos los canales, uno por uno, año a año.
 *
 * Es el respaldo de la gráfica: allí solo caben siete canales con color, aquí
 * está la lista entera con sus números exactos. También es lo que hace legible
 * la pantalla para quien no distingue bien los colores.
 *
 * La última columna compara el año en curso con el MISMO tramo del anterior
 * (de enero al mes de hoy), que es la única comparación honesta a mitad de año.
 */

interface Props {
  porMes: MesCanal[];
  anioEnCurso: number;
  /** Último mes con datos del año en curso. */
  hastaMes: number;
}

export function TablaComparativa({ porMes, anioEnCurso, hastaMes }: Props) {
  const anios = useMemo(() => aniosConDatos(porMes), [porMes]);
  const canales = useMemo(() => rankingCanales(porMes), [porMes]);
  const porCanal = useMemo(() => reservasPorCanalYAnio(porMes), [porMes]);

  const totalUltimo = useMemo(
    () =>
      porMes
        .filter((m) => m.anio === anioEnCurso)
        .reduce((s, m) => s + m.reservas, 0),
    [porMes, anioEnCurso],
  );

  if (canales.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr
            className="border-b text-[.7rem] uppercase tracking-[.07em] text-muted-foreground"
            style={TITULAR}
          >
            <th className="p-3 text-left font-medium">Canal</th>
            {anios.map((a) => (
              <th key={a} className="p-3 text-right font-medium">
                {a}
                {a === anioEnCurso && <span className="font-normal"> *</span>}
              </th>
            ))}
            <th className="p-3 text-right font-medium">Peso hoy</th>
            <th className="p-3 text-right font-medium">Vs. año pasado</th>
          </tr>
        </thead>
        <tbody>
          {canales.map((canal) => {
            const fila = porCanal.get(canal);
            const { actual, anterior } = compararMismoTramo(
              porMes,
              anioEnCurso,
              hastaMes,
              canal,
            );
            const dif = variacion(actual.reservas, anterior.reservas);
            const peso = totalUltimo > 0 ? (actual.reservas / totalUltimo) * 100 : 0;
            return (
              <tr key={canal} className="border-b last:border-0">
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: colorOrigen(canal) }}
                    />
                    {labelOrigen(canal)}
                  </span>
                </td>
                {anios.map((a) => (
                  <td key={a} className="p-3 text-right text-[.86rem]" style={CIFRA}>
                    {formatNumero(fila?.get(a) ?? 0)}
                  </td>
                ))}
                <td className="p-3 text-right">
                  <span className="flex items-center justify-end gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.min(100, peso)}%`,
                          backgroundColor: colorOrigen(canal),
                        }}
                      />
                    </span>
                    <span className="w-14 text-[.86rem]" style={CIFRA}>
                      {formatPorcentaje(peso, { max: 1 })}
                    </span>
                  </span>
                </td>
                <td
                  style={CIFRA}
                  className={cn(
                    "p-3 text-right text-[.86rem]",
                    dif === null && "text-muted-foreground",
                    dif !== null && dif > 0.5 && "text-emerald-600",
                    dif !== null && dif < -0.5 && "text-red-600",
                  )}
                >
                  {dif === null
                    ? "—"
                    : `${dif > 0 ? "+" : ""}${formatPorcentaje(dif, { max: 1 })}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground">
        * {anioEnCurso} va hasta hoy. La última columna compara solo lo que llevamos
        de año con ese mismo tramo del año pasado.
      </p>
    </div>
  );
}
