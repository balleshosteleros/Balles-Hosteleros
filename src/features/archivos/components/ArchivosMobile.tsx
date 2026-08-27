"use client";

/**
 * PRP-079 — Archivos en el móvil: pantalla completa dentro de /m.
 *
 * Envoltorio fino sobre `ArchivosExplorador`, el mismo que usa el panel del
 * escritorio. Aquí las acciones (Carpeta / Subir) van en la cabecera fija,
 * junto al botón de volver.
 *
 * Es la vía principal para subir archivos desde el iPhone: el botón "Subir"
 * abre el selector nativo y admite marcar muchos de una vez.
 */

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
              <div className="flex items-center justify-end gap-2 border-b px-3 py-2">
                {acciones}
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
