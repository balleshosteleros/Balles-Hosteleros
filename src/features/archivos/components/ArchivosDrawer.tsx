"use client";

/**
 * PRP-079 — Archivos en la barra superior del escritorio.
 *
 * Envoltorio fino: mismo patrón de apertura que el resto de herramientas
 * (Agenda, Tareas, Chat) — un Sheet lateral que envuelve al botón de la barra.
 * Toda la lógica vive en `ArchivosExplorador`, compartida con la pantalla del
 * móvil para no duplicarla.
 */

import { ReactNode, useState } from "react";
import { Folder } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArchivosExplorador } from "@/features/archivos/components/ArchivosExplorador";

export function ArchivosDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <ArchivosExplorador
          variante="drawer"
          abierto={open}
          renderAcciones={(acciones) => (
            <SheetHeader className="border-b py-3 pl-5 pr-14 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Folder className="h-4 w-4 text-cyan-600" />
                  Archivos
                </SheetTitle>
                {acciones}
              </div>
            </SheetHeader>
          )}
        />
      </SheetContent>
    </Sheet>
  );
}
