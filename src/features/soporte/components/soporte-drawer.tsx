"use client";

import { ReactNode } from "react";
import { LifeBuoy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface SoporteDrawerProps {
  children: ReactNode;
}

export function SoporteDrawer({ children }: SoporteDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Soporte
          </SheetTitle>
          <SheetDescription className="text-xs">
            Chat con el asistente de Balles Hosteleros
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Próximamente</p>
            <p className="mt-2">
              El chat de soporte con IA estará disponible en la Fase 3 de esta
              implementación.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
