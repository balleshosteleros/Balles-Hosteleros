"use client";

/**
 * EL círculo de elegir una opción — sustituye al `<input type="radio">`.
 *
 * El círculo del navegador lo pinta el sistema operativo: azul de fábrica en
 * Windows, gris con brillo en Mac, y de otro tamaño en cada uno. Este va
 * siempre igual y en el color del software.
 *
 * Se usa suelto, igual que se usaba el nativo: cada círculo sabe si está
 * elegido (`checked`) y qué hacer al pulsarlo (`onChange`). No hace falta
 * agruparlos: quien manda es el dato, como ya pasaba antes con `name`.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CirculoOpcionProps {
  /** Si esta es la opción elegida. */
  checked: boolean;
  /** Se pulsa para elegir ESTA. Como el nativo, no se puede des-elegir. */
  onChange: () => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  /**
   * Color de marca, en las webs de cada restaurante. Sin él, el del software.
   * Va en línea porque el círculo se pinta con `borderColor`/`background` y
   * esos colores vienen de la base de datos, no de una clase.
   */
  color?: string | null;
}

export const CirculoOpcion = React.forwardRef<HTMLButtonElement, CirculoOpcionProps>(
  function CirculoOpcion(
    { checked, onChange, disabled, className, id, color, "aria-label": ariaLabel },
    ref,
  ) {
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        style={color ? { borderColor: color } : undefined}
        onClick={() => {
          if (!disabled) onChange();
        }}
        className={cn(
          "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          "border border-primary ring-offset-background transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {checked && (
          <span
            className="h-2 w-2 rounded-full bg-primary"
            style={color ? { backgroundColor: color } : undefined}
            aria-hidden
          />
        )}
      </button>
    );
  },
);
