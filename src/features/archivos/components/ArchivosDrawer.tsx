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
import { Folder, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetMaximizeButton,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArchivosExplorador } from "@/features/archivos/components/ArchivosExplorador";

export function ArchivosDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      {/*
        `[&>button]:hidden` esconde los botones que el panel pinta flotando en
        la esquina: se solapaban con la cabecera de Archivos (el de ampliar caía
        justo encima del de cerrar y del botón "Subir"). Aquí van los dos en
        fila dentro de la cabecera, como en el resto de herramientas.
      */}
      <SheetContent
        side="right"
        maximizable
        className="flex flex-col gap-0 p-0 [&>button]:hidden"
      >
        <ArchivosExplorador
          variante="drawer"
          abierto={open}
          renderAcciones={(acciones) => (
            <SheetHeader className="border-b py-3 pl-5 pr-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Folder className="h-4 w-4 text-cyan-600" />
                  Archivos
                </SheetTitle>
                <div className="flex items-center gap-1">
                  {acciones}
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
          )}
        />
      </SheetContent>
    </Sheet>
  );
}
