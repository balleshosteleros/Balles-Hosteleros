"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Etiqueta de los iconos de la barra de herramientas.
 *
 * Sustituye al `title=` nativo del navegador: ese recuadro gris de esquinas
 * cuadradas lo pinta el sistema operativo, no el software, y no hay forma de
 * darle ni forma ni color (Iván, 06-sep). Aquí va una píldora completamente
 * redonda, en el color del propio software y con la misma sombra suave que el
 * resto de flotantes.
 *
 * CUIDADO con la cadena de `asChild`: cada icono vive dentro de su Drawer, que
 * es un `SheetTrigger asChild` y por tanto CLONA a su hijo para inyectarle el
 * `onClick` y la `ref` que abren el panel. Como ese hijo ha pasado a ser este
 * componente, hay que reenviarle ambas cosas al botón de dentro con un `Slot`
 * y `forwardRef`; sin eso los iconos se quedan mudos: se ven, pero no abren
 * nada.
 */
export const ToolTooltip = React.forwardRef<
  HTMLElement,
  { label: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>
>(function ToolTooltip({ label, children, ...triggerProps }, ref) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Slot ref={ref} {...triggerProps}>
          {children}
        </Slot>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={8}
        // Redonda del todo y sin borde: es una etiqueta, no una tarjeta.
        className="rounded-full border-0 bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
});
