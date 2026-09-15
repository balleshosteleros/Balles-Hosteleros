"use client";

import { useMemo } from "react";
import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { formatNumero } from "@/shared/lib/numero";
import type { MesCanal } from "../types";
import { aniosConDatos, canalesDestacados } from "../lib/agregados";
import { CIFRA } from "../lib/estilo";
import { Leyenda } from "./GraficaCanalesAnio";

/**
 * Cuál sube y cuál baja: cada canal por su cuenta, año a año.
 *
 * La gráfica apilada de al lado dice cuánto entró en total; esta dice qué le
 * pasa a cada canal por separado, que es lo que se mira para decidir dónde
 * meter el dinero.
 *
 * Un año sin ninguna reserva de ese canal deja HUECO, no un cero. No es lo
 * mismo "ese año no vino nadie por ahí" que "ese año todavía no se anotaba":
 * el walk in no se registró hasta 2025, y una línea cayendo a cero diría que
 * dejó de entrar gente andando.
 *
 * Solo los tres canales más grandes llevan su nombre al final de la línea: con
 * siete rótulos amontonados no se leería ninguno. Los demás, en la leyenda.
 */

const ANCHO = 900;
const ALTO = 360;
const MARGEN = { arriba: 30, abajo: 42, izquierda: 56, derecha: 96 };
const CON_ROTULO = 3;

interface Props {
  porMes: MesCanal[];
  anioEnCurso: number;
}

export function GraficaTendenciaCanales({ porMes, anioEnCurso }: Props) {
  const destacados = useMemo(() => canalesDestacados(porMes), [porMes]);
  const anios = useMemo(() => aniosConDatos(porMes), [porMes]);

  const valores = useMemo(() => {
    const acc = new Map<string, Map<number, number>>();
    for (const m of porMes) {
      if (!destacados.includes(m.canal)) continue;
      const porAnio = acc.get(m.canal) ?? new Map<number, number>();
      porAnio.set(m.anio, (porAnio.get(m.anio) ?? 0) + m.reservas);
      acc.set(m.canal, porAnio);
    }
    return acc;
  }, [porMes, destacados]);

  if (anios.length < 2) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Hace falta más de un año de historia para ver la tendencia.
      </div>
    );
  }

  const maximo = Math.max(
    1,
    ...[...valores.values()].flatMap((m) => [...m.values()]),
  );
  const tope = Math.ceil(maximo / 500) * 500 || 500;
  const rejilla = [0, 1, 2, 3, 4].map((i) => (tope / 4) * i);

  const utilAncho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const utilAlto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const y = (v: number) => MARGEN.arriba + utilAlto - (v / tope) * utilAlto;
  const x = (i: number) => MARGEN.izquierda + (utilAncho / (anios.length - 1)) * i;

  return (
    <div className="space-y-4">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label="Evolución de cada canal por año"
        style={CIFRA}
      >
        <text
          x={MARGEN.izquierda - 10}
          y={MARGEN.arriba - 12}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          reservas
        </text>

        {rejilla.map((v) => (
          <g key={v}>
            <line
              x1={MARGEN.izquierda}
              x2={ANCHO - MARGEN.derecha}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MARGEN.izquierda - 10}
              y={y(v) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {formatNumero(v)}
            </text>
          </g>
        ))}

        {anios.map((anio, i) => (
          <text
            key={anio}
            x={x(i)}
            y={ALTO - 14}
            textAnchor="middle"
            className="fill-muted-foreground text-[13px] font-medium"
          >
            {anio}
            {anio === anioEnCurso ? "*" : ""}
          </text>
        ))}

        {destacados.map((canal, orden) => {
          const puntos = anios
            .map((anio, i) => ({ i, anio, valor: valores.get(canal)?.get(anio) }))
            .filter((p): p is { i: number; anio: number; valor: number } =>
              p.valor !== undefined,
            );
          if (puntos.length === 0) return null;
          const trazo = puntos
            .map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i)},${y(p.valor)}`)
            .join(" ");
          const fin = puntos[puntos.length - 1];
          return (
            <g key={canal}>
              <path
                d={trazo}
                fill="none"
                stroke={colorOrigen(canal)}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {puntos.map((p) => (
                <circle
                  key={p.anio}
                  cx={x(p.i)}
                  cy={y(p.valor)}
                  r={3.5}
                  fill={colorOrigen(canal)}
                  stroke="hsl(var(--card))"
                  strokeWidth={1.5}
                >
                  <title>
                    {p.anio} · {labelOrigen(canal)}: {formatNumero(p.valor)} reservas
                  </title>
                </circle>
              ))}
              {orden < CON_ROTULO && (
                <text
                  x={x(fin.i) + 10}
                  y={y(fin.valor) + 4}
                  className="text-[11px]"
                  fill={colorOrigen(canal)}
                >
                  {labelOrigen(canal)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <Leyenda canales={destacados} />

      <p className="text-xs text-muted-foreground">
        Un canal sin línea en un año es que ese año no se anotó nada por ahí: el walk in
        no empezó a registrarse hasta 2025.
      </p>
    </div>
  );
}
