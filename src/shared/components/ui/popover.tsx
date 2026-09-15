import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

/**
 * DENTRO DE UNA VENTANA (Dialog), ESTE POPOVER VA SIEMPRE CON `modal`.
 *
 * En Safari —o sea, en TODOS los iPhone— tocar un `<button>` no le da el foco.
 * Al abrirse el panel, la ventana ve que el foco anda fuera de ella y se lo
 * lleva de vuelta; el panel lo interpreta como "han tocado fuera" y se cierra
 * en el mismo milisegundo. El usuario ve el desplegable muerto: lo toca y no
 * pasa nada. Así se quedaron sin poder elegir fecha todas las solicitudes del
 * teléfono (Iván, 15-sep-2026).
 *
 * `modal` lo arregla de raíz: el panel pasa a mandar sobre el foco mientras
 * está abierto y deja de leer como "fuera" lo que hace la ventana que lo
 * contiene. Nuestros selectores propios (fecha, opción, múltiple y color) ya lo
 * llevan puesto.
 */
const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
