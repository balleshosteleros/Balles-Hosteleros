"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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
 *
 * Lleva su propio `TooltipProvider` por dos razones: las webs públicas (carta,
 * portal de empleo, formación) viven fuera de `Providers` y sin él la pantalla
 * se cae, y así la espera es de 150 ms —el `title=` del sistema tardaba casi un
 * segundo en asomar—. Sin etiqueta que enseñar, deja pasar al hijo tal cual.
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
  // SIN ETIQUETA que enseñar, este componente se aparta... pero NO puede
  // soltar lo que le hayan inyectado desde fuera. Antes devolvia el hijo
  // "pelado" y con el se iban el `onClick` y la `ref` de quien lo envuelve:
  // una mesa del plano solo lleva etiqueta mientras se mueve una reserva, asi
  // que en el uso normal el desplegable de la mesa no abria (en el listado si,
  // porque alli no hay etiqueta de por medio). El `Slot` mantiene el puente.
  if (label === null || label === undefined || label === "") {
    const hayQueReenviar = ref !== null || Object.keys(triggerProps).length > 0;
    if (!hayQueReenviar) return <>{children}</>;
    return (
      <Slot ref={ref} {...triggerProps}>
        {children}
      </Slot>
    );
  }
  return (
    <TooltipProvider delayDuration={150}>
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
    </TooltipProvider>
  );
});
