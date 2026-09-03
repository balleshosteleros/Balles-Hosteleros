"use client";

/**
 * PRP-084 — Google Drive en la barra superior, entre Calendario y Meet.
 *
 * Mismo patrón que Gmail, Calendar y Meet: un Sheet lateral que envuelve al
 * botón de la barra. Toda la lógica vive en `DriveExplorador`.
 *
 * Solo escritorio: la barra donde se monta ya es `hidden md:flex`.
 */

import { ReactNode, useState } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetMaximizeButton,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DriveExplorador } from "./DriveExplorador";
import { DriveIcon } from "./DriveIcon";

export function DriveDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        maximizable
        className="flex flex-col gap-0 p-0 [&>button]:hidden"
      >
        <SheetHeader className="shrink-0 border-b py-3 pl-5 pr-3">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <DriveIcon className="h-4 w-4" />
              Archivos
            </SheetTitle>
            <div className="flex items-center gap-1">
              <SheetMaximizeButton
                className="h-8 w-8 p-0"
                iconClassName="h-4 w-4"
              />
              <SheetClose className="flex h-8 w-8 items-center justify-center rounded-full opacity-70 transition-colors hover:bg-black/5 hover:opacity-100">
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <DriveExplorador abierto={open} />
      </SheetContent>
    </Sheet>
  );
}
