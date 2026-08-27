"use client";

/**
 * PRP-079 — Archivos en el móvil: pantalla completa dentro de /m.
 *
 * Envoltorio fino sobre `ArchivosExplorador`, el mismo que usa el panel del
 * escritorio. Aquí las acciones (Carpeta / Subir) van en la cabecera fija,
 * junto al botón de volver.
 *
 * Es la vía principal para subir fotos y vídeos desde el iPhone: el botón
 * "Subir" abre la galería nativa y admite seleccionar muchos de una vez.
 */

import { FolderOpen } from "lucide-react";
import { MobilePageHeader } from "@/features/mi-panel/mobile/components/MobilePageHeader";
import { ArchivosExplorador } from "@/features/archivos/components/ArchivosExplorador";

export function ArchivosMobile() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ArchivosExplorador
        variante="pagina"
        renderAcciones={(acciones) => (
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur">
            <MobilePageHeader title="Archivos" />
            {acciones && (
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FolderOpen className="h-3.5 w-3.5 text-cyan-600" />
                  Fotos y vídeos de la empresa
                </span>
                {acciones}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
