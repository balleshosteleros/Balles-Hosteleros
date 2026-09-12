"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * LA etiqueta flotante del software. Única para toda la app.
 *
 * Sustituye al `title=` nativo del navegador: ese recuadro gris de esquinas
 * cuadradas lo pinta el sistema operativo, no el software, tarda un segundo en
 * aparecer, sale con la tipografía del sistema y no hay forma de darle ni
 * forma ni color (Iván, 06-sep). Nada de fuera del software: aquí va una
 * píldora nuestra, en el color del propio software y con la misma sombra suave
 * que el resto de flotantes.
 *
 * `label` admite texto o una pieza entera (por ejemplo, el detalle de un turno
 * con su color de departamento); en ese caso, `className` deja abrir la
 * píldora a tarjeta con `rounded-2xl` y algo más de aire.
 *
 * CUIDADO con la cadena de `asChild`: cada icono de la barra vive dentro de su
 * Drawer, que es un `SheetTrigger asChild` y por tanto CLONA a su hijo para
 * inyectarle el `onClick` y la `ref` que abren el panel. Como ese hijo ha
 * pasado a ser este componente, hay que reenviarle ambas cosas al botón de
 * dentro con un `Slot` y `forwardRef`; sin eso los iconos se quedan mudos: se
 * ven, pero no abren nada.
 */
export const ToolTooltip = React.forwardRef<
  HTMLElement,
  {
    label: React.ReactNode;
    children: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    /** Aire y forma de la etiqueta cuando lleva varias líneas. */
    className?: string;
  } & React.HTMLAttributes<HTMLElement>
>(function ToolTooltip(
  { label, children, side = "bottom", sideOffset = 8, className, ...triggerProps },
  ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Slot ref={ref} {...triggerProps}>
          {children}
        </Slot>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        // Redonda del todo y sin borde: es una etiqueta, no una tarjeta.
        className={cn(
          "rounded-full border-0 bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg",
          className,
        )}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
});
