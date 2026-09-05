"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Desplegable PROPIO — sustituye al `<select>` nativo.
 *
 * El `<select>` abre la lista del sistema operativo: tipografía, esquinas y
 * colores del equipo del cliente, distintos en cada Mac, Windows o móvil. Al
 * lado de nuestros campos se nota que no es nuestro. Este va siempre igual,
 * con el mismo lenguaje que el calendario: bordes redondeados, opción elegida
 * en el color de la empresa y sombra suave.
 *
 * Mantiene la interfaz del nativo (`value` / `onChange` con la cadena del
 * valor) para poder sustituirlo sin tocar la lógica de los formularios.
 */

export interface OpcionSelector {
  value: string;
  /** Texto de la opción. */
  label: string;
  /** Se muestra apagada y no se puede elegir (p. ej. "Zona completa"). */
  disabled?: boolean;
  /** Nota a la derecha, en gris: "(Zona completa)", "(sin sitio)"… */
  nota?: string;
  /** Emoji o bandera delante del texto. */
  prefijo?: string;
  /**
   * Título de sección bajo el que se agrupa ("Comida", "Cena"). Las opciones
   * se pintan en el orden recibido y la cabecera sale al cambiar de grupo.
   */
  grupo?: string;
}

export interface SelectorOpcionProps {
  value: string;
  onChange: (valor: string) => void;
  opciones: OpcionSelector[];
  id?: string;
  disabled?: boolean;
  /** Texto cuando no hay nada elegido. */
  placeholder?: string;
  /** Clases del disparador: hereda alto y borde del formulario. */
  className?: string;
  /** Ancho del panel. Por defecto, el del propio disparador. */
  anchoPanel?: string;
  /** Estilo del disparador: lo usa el borde teñido de marca al elegir. */
  style?: React.CSSProperties;
  /** Color de la opción elegida. Sin él, negro. */
  colorMarca?: string | null;
  colorMarcaTexto?: string | null;
  "aria-label"?: string;
}

export function SelectorOpcion({
  value,
  onChange,
  opciones,
  id,
  disabled,
  placeholder = "Seleccione una opción",
  className,
  anchoPanel,
  style,
  colorMarca,
  colorMarcaTexto,
  "aria-label": ariaLabel,
}: SelectorOpcionProps) {
  const [abierto, setAbierto] = React.useState(false);

  const elegida = opciones.find((o) => o.value === value && o.value !== "");

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          style={style}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm text-zinc-900",
            "transition-colors hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500",
            !elegida && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {elegida ? (
              <>
                {elegida.prefijo ? `${elegida.prefijo} ` : ""}
                {elegida.label}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
              abierto && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        // El panel copia el ancho del campo, como haría el nativo.
        className={cn(
          "max-h-72 overflow-y-auto rounded-2xl border-zinc-200/80 p-1.5 shadow-xl",
          anchoPanel ?? "w-[var(--radix-popover-trigger-width)]",
        )}
        style={
          {
            ...(colorMarca ? { ["--brand" as string]: colorMarca } : {}),
            ...(colorMarcaTexto ? { ["--brand-fg" as string]: colorMarcaTexto } : {}),
          } as React.CSSProperties
        }
      >
        {opciones.map((o, i) => {
          const activa = o.value === value;
          // Cabecera solo al cambiar de sección, no en cada opción.
          const abreGrupo = !!o.grupo && o.grupo !== opciones[i - 1]?.grupo;
          return (
            <React.Fragment key={o.value}>
              {abreGrupo ? (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {o.grupo}
                </p>
              ) : null}
            <button
              type="button"
              disabled={o.disabled}
              onClick={() => {
                if (o.disabled) return;
                onChange(o.value);
                setAbierto(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent",
                activa &&
                  "!bg-[var(--brand,#18181b)] !text-[var(--brand-fg,#fff)] font-semibold hover:!bg-[var(--brand,#18181b)]",
              )}
            >
              <span className="truncate">
                {o.prefijo ? `${o.prefijo} ` : ""}
                {o.label}
                {o.nota ? (
                  <span className={cn("ml-1 text-xs", !activa && "text-zinc-400")}>{o.nota}</span>
                ) : null}
              </span>
              {activa ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
            </button>
            </React.Fragment>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
