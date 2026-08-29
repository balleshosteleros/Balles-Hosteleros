import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { Maximize2, Minimize2, X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-full sm:w-[50vw] sm:max-w-[50vw] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 h-full w-full sm:w-[50vw] sm:max-w-[50vw] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
      /**
       * Panel a pantalla completa. Sólo lo usan las herramientas: en el resto
       * de sheets la variante queda sin definir y nada cambia.
       */
      maximizado: {
        true: "sm:!w-screen sm:!max-w-none sm:transition-[width,max-width] sm:duration-200",
        false: "sm:transition-[width,max-width] sm:duration-200",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    Omit<VariantProps<typeof sheetVariants>, "maximizado"> {
  /**
   * Herramientas (Email, Calendario, Chat...): añade el botón de ampliar a
   * pantalla completa. Siempre abren en tamaño normal; ampliar es una acción
   * del usuario y no se recuerda entre aperturas.
   */
  maximizable?: boolean;
}

/** Estado de "pantalla completa" del panel, para que la cabecera de cada herramienta lo lea. */
const SheetMaximizeContext = React.createContext<{
  maximizado: boolean;
  alternar: () => void;
} | null>(null);

/** Sólo dentro de un SheetContent con `maximizable`. Devuelve null si no aplica. */
function useSheetMaximize() {
  return React.useContext(SheetMaximizeContext);
}

/**
 * Botón de ampliar / reducir el panel. Se coloca en la cabecera de cada
 * herramienta, junto al de cerrar. No se pinta en móvil: allí el panel ya
 * ocupa toda la pantalla.
 */
const SheetMaximizeButton = ({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) => {
  const ctx = useSheetMaximize();
  if (!ctx) return null;
  const Icono = ctx.maximizado ? Minimize2 : Maximize2;
  const etiqueta = ctx.maximizado ? "Reducir" : "Ampliar a pantalla completa";
  return (
    <button
      type="button"
      onClick={ctx.alternar}
      title={etiqueta}
      className={cn(
        "hidden sm:inline-flex items-center justify-center rounded-full p-3 opacity-70 transition-colors hover:bg-black/5 hover:opacity-100",
        className,
      )}
    >
      <Icono className={cn("h-5 w-5", iconClassName)} />
      <span className="sr-only">{etiqueta}</span>
    </button>
  );
};
SheetMaximizeButton.displayName = "SheetMaximizeButton";

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", maximizable = false, className, children, ...props }, ref) => {
    const [maximizado, setMaximizado] = React.useState(false);
    const alternar = React.useCallback(() => setMaximizado((v) => !v), []);
    const ctx = React.useMemo(() => ({ maximizado, alternar }), [maximizado, alternar]);

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={ref}
          className={cn(
            sheetVariants({ side, maximizado: maximizable ? maximizado : undefined }),
            className,
          )}
          {...props}
        >
          <SheetMaximizeContext.Provider value={maximizable ? ctx : null}>
            {children}
          </SheetMaximizeContext.Provider>
          {/*
            Panel sin cabecera propia: el botón de ampliar acompaña a la X de
            cerrar. Los que sí tienen cabecera ocultan ambos con
            `[&>button]:hidden` y colocan <SheetMaximizeButton /> donde toca.
          */}
          {maximizable && (
            <button
              type="button"
              onClick={alternar}
              title={maximizado ? "Reducir" : "Ampliar a pantalla completa"}
              className="absolute right-11 top-4 hidden rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:inline-flex"
            >
              {maximizado ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="sr-only">{maximizado ? "Reducir" : "Ampliar a pantalla completa"}</span>
            </button>
          )}
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetMaximizeButton,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  useSheetMaximize,
};
