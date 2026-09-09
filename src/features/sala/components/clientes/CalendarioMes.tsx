"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Rejilla de un mes pintada como mapa de calor.
 *
 * Es nuestra, no la del navegador: el calendario del sistema no sabe teñir un
 * día según lo que pasó ese día ni llevar el color de la empresa, que es todo
 * lo que se le pide aquí.
 *
 * La intensidad es RELATIVA al mes que se está mirando: el día más fuerte se
 * pinta a tope y el resto en proporción. Así un febrero flojo también se lee,
 * en vez de salir entero en blanco por comparación con diciembre.
 */

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? "";
}

/** Cuántos días tiene el mes (con su febrero bisiesto). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Hueco inicial: la semana empieza en lunes, no en domingo. */
function huecoInicial(anio: number, mes: number): number {
  return (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7;
}

interface CalendarioMesProps {
  anio: number;
  /** 1-12. */
  mes: number;
  /** Día del mes (1-31) → cuánto vale ese día. Los que falten van a cero. */
  valores: Record<number, number>;
  /** Color de la empresa: es el que tiñe el mapa de calor. */
  color: string;
  /** Día del mes de HOY, si hoy cae en este mes. */
  hoy?: number | null;
  seleccionado?: number | null;
  onSeleccionar?: (dia: number) => void;
  onMesAnterior: () => void;
  onMesSiguiente: () => void;
  /** Texto del pie: qué significa el número que se ve en cada día. */
  leyenda: string;
  /** Acción a la derecha del título (por ejemplo, volver a hoy). */
  extraCabecera?: React.ReactNode;
  /** Se pinta el año junto al mes. En cumpleaños no dice nada y se oculta. */
  mostrarAnio?: boolean;
}

export function CalendarioMes({
  anio,
  mes,
  valores,
  color,
  hoy = null,
  seleccionado = null,
  onSeleccionar,
  onMesAnterior,
  onMesSiguiente,
  leyenda,
  extraCabecera,
  mostrarAnio = true,
}: CalendarioMesProps) {
  const total = diasDelMes(anio, mes);
  const hueco = huecoInicial(anio, mes);
  const maximo = Math.max(0, ...Object.values(valores));

  const celdas: (number | null)[] = [
    ...Array.from({ length: hueco }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  /**
   * Del 0 al 100 sobre el día más fuerte del mes. Un día con algo nunca baja
   * del 12 %: si no, un día suelto en un mes con una punta muy alta queda
   * indistinguible de un día vacío.
   */
  const intensidad = (v: number): number => {
    if (!v || maximo <= 0) return 0;
    return Math.round(12 + (v / maximo) * 88);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onMesAnterior}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium capitalize">
            {nombreMes(mes)}
            {mostrarAnio ? ` ${anio}` : ""}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onMesSiguiente}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
        {extraCabecera}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="pb-1 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}

        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`v-${i}`} />;
          const valor = valores[dia] ?? 0;
          const pct = intensidad(valor);
          const fuerte = pct >= 55;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => valor > 0 && onSeleccionar?.(dia)}
              disabled={valor === 0}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-md border text-center transition-colors",
                valor > 0
                  ? "cursor-pointer border-transparent hover:brightness-95"
                  : "cursor-default border-dashed border-border/60 bg-transparent",
                seleccionado === dia && "ring-2 ring-offset-1 ring-foreground/40",
              )}
              style={
                valor > 0
                  ? { backgroundColor: `color-mix(in srgb, ${color} ${pct}%, transparent)` }
                  : undefined
              }
            >
              <span
                className={cn(
                  "absolute left-1.5 top-1 text-[10px] leading-none",
                  hoy === dia ? "font-semibold" : "font-normal",
                  fuerte ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {dia}
                {hoy === dia ? " ·" : ""}
              </span>
              {valor > 0 && (
                <span
                  className={cn(
                    "text-base font-semibold leading-none",
                    fuerte ? "text-white" : "text-foreground",
                  )}
                >
                  {valor}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{leyenda}</span>
        <span className="flex items-center gap-1">
          Menos
          {[12, 34, 56, 78, 100].map((p) => (
            <span
              key={p}
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: `color-mix(in srgb, ${color} ${p}%, transparent)` }}
            />
          ))}
          Más
        </span>
      </div>
    </div>
  );
}
