"use client";

import { useMemo } from "react";
import { colorOrigen, labelOrigen } from "@/features/sala/data/origenes";
import { formatNumero } from "@/shared/lib/numero";
import type { MesCanal } from "../types";
import { CANAL_RESTO, canalesDestacados, filasPorAnio } from "../lib/agregados";
import { CIFRA, COLOR_RESTO } from "../lib/estilo";

/**
 * Qué trajo cada canal, año a año. Barras apiladas, dibujadas a mano en SVG.
 *
 * Apiladas y no líneas porque la pregunta es doble: cuánto entró ese año (la
 * altura, con su número encima) y de dónde vino (los tramos). Los colores son
 * los del canal en el resto del software (`colorOrigen`), para que el verde de
 * Google sea el mismo aquí que en el listado de reservas.
 *
 * Entre tramo y tramo hay 2 px del color del fondo: dos canales de tonos
 * parecidos —el verde de Google y el turquesa de la web— se separan por el
 * corte aunque el ojo dude del color.
 *
 * El montón gris de canales pequeños va SIEMPRE abajo, para que los grandes se
 * apoyen en una base que no se mueve de un año a otro.
 */

const ANCHO = 900;
const ALTO = 380;
const MARGEN = { arriba: 30, abajo: 42, izquierda: 56, derecha: 12 };

interface Props {
  porMes: MesCanal[];
  /** Año que aún no ha terminado: su barra es más corta por fuerza. */
  anioEnCurso: number;
}

export function GraficaCanalesAnio({ porMes, anioEnCurso }: Props) {
  const destacados = useMemo(() => canalesDestacados(porMes), [porMes]);
  const filas = useMemo(() => filasPorAnio(porMes, destacados), [porMes, destacados]);

  const { barras, rejilla, tope } = useMemo(() => {
    const barras = filas.map((f) => {
      const anio = Number(f.anio);
      const tramos = [CANAL_RESTO, ...[...destacados].reverse()]
        .map((canal) => ({ canal, valor: Number(f[canal] ?? 0) }))
        .filter((t) => t.valor > 0);
      const total = tramos.reduce((s, t) => s + t.valor, 0);
      return { anio, tramos, total };
    });
    const maximo = Math.max(1, ...barras.map((b) => b.total));
    const tope = Math.ceil(maximo / 1000) * 1000 || 1000;
    const rejilla = [0, 1, 2, 3, 4].map((i) => (tope / 4) * i);
    return { barras, rejilla, tope };
  }, [filas, destacados]);

  if (filas.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Todavía no hay reservas con canal anotado.
      </div>
    );
  }

  const utilAncho = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const utilAlto = ALTO - MARGEN.arriba - MARGEN.abajo;
  const y = (v: number) => MARGEN.arriba + utilAlto - (v / tope) * utilAlto;
  const paso = utilAncho / barras.length;
  const ancho = Math.min(88, paso * 0.56);

  return (
    <div className="space-y-4">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label="Reservas por año y canal"
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

        {barras.map((barra, i) => {
          const x = MARGEN.izquierda + paso * i + (paso - ancho) / 2;
          let acumulado = 0;
          return (
            <g key={barra.anio}>
              {barra.tramos.map((tramo) => {
                const arriba = y(acumulado + tramo.valor);
                const alto = (tramo.valor / tope) * utilAlto;
                acumulado += tramo.valor;
                const relleno =
                  tramo.canal === CANAL_RESTO ? COLOR_RESTO : colorOrigen(tramo.canal);
                return (
                  <rect
                    key={tramo.canal}
                    x={x}
                    y={arriba}
                    width={ancho}
                    height={Math.max(0, alto)}
                    fill={relleno}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    <title>
                      {barra.anio} · {nombreSerie(tramo.canal)}:{" "}
                      {formatNumero(tramo.valor)} reservas
                    </title>
                  </rect>
                );
              })}
              <text
                x={x + ancho / 2}
                y={y(barra.total) - 9}
                textAnchor="middle"
                className="fill-foreground text-[12px] font-medium"
              >
                {formatNumero(barra.total)}
              </text>
              <text
                x={x + ancho / 2}
                y={ALTO - 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[13px] font-medium"
              >
                {barra.anio}
                {barra.anio === anioEnCurso ? "*" : ""}
              </text>
            </g>
          );
        })}
      </svg>

      <Leyenda canales={[...destacados, CANAL_RESTO]} />

      <p className="text-xs text-muted-foreground">
        Los siete canales que más traen llevan color propio; el resto se apila junto en
        gris. * {anioEnCurso} va hasta hoy. En la tabla de abajo están todos, uno por uno.
      </p>
    </div>
  );
}

/** Leyenda compartida: cuadrito de color y nombre del canal. */
export function Leyenda({ canales }: { canales: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {canales.map((canal) => (
        <span key={canal} className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
            style={{
              backgroundColor: canal === CANAL_RESTO ? COLOR_RESTO : colorOrigen(canal),
            }}
          />
          {nombreSerie(canal)}
        </span>
      ))}
    </div>
  );
}

function nombreSerie(clave: string): string {
  return clave === CANAL_RESTO ? "Otros canales" : labelOrigen(clave);
}
