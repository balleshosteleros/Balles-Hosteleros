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
import { DriveLogo } from "./DriveIcon";
import { GoogleAccountButton } from "./GoogleAccountButton";

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
        {/* El nombre va dentro del logo, como en Gmail, Calendar y Meet: el
            título queda solo para lectores de pantalla. */}
        <SheetTitle className="sr-only">Drive · Google Drive</SheetTitle>
        <SheetHeader className="shrink-0 border-b px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 pl-1 pr-3">
              <DriveLogo className="h-9 w-auto" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              {/* La cuenta de Google se cambia desde aquí, igual que en Correo,
                  Calendario y Reuniones: es la MISMA cuenta activa para las
                  cuatro herramientas, así que cambiarla aquí la cambia en todas. */}
              <GoogleAccountButton />
              <SheetMaximizeButton className="text-[#5f6368]" />
              <SheetClose asChild>
                <button
                  type="button"
                  className="ml-1 rounded-full p-3 transition-colors hover:bg-black/5"
                  title="Cerrar"
                >
                  <X className="h-5 w-5 text-[#5f6368]" />
                </button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <DriveExplorador abierto={open} />
      </SheetContent>
    </Sheet>
  );
}
