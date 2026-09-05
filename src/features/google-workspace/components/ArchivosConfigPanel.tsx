"use client";

/**
 * Panel de Archivos en Ajustes → Herramientas.
 *
 * Archivos ES Google Drive (PRP-084): el explorador propio (PRP-079) se retiró
 * al quedarse sin uso, así que aquí no hay nada que configurar salvo con qué
 * cuenta de Google se está mirando. Quién ve qué lo decide Google según los
 * permisos de la propia carpeta, no el software.
 */

import { Folder } from "lucide-react";
import { HERRAMIENTA, toolTextColor } from "@/features/layout/data/herramientas";
import { GoogleConnectBanner } from "./GoogleConnectBanner";
import { useGoogleConnection } from "./useGoogleConnection";

export function ArchivosConfigPanel() {
  const { connected, email } = useGoogleConnection();

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <Folder
          className={`h-4 w-4 ${toolTextColor(HERRAMIENTA.archivos.colorKey)}`}
        />
        <span className="text-sm font-medium">Google Drive</span>
      </div>

      {connected ? (
        <p className="text-xs text-muted-foreground">
          Archivos muestra el Drive de <span className="font-medium">{email}</span> en
          vivo: lo que cambie en Drive aparece aquí al volver a entrar. Se ve
          «Mi unidad» y «Compartido conmigo», y quién ve cada carpeta lo decide
          Google según los permisos que tenga en el propio Drive.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Conecta una cuenta de Google para ver sus archivos desde el portal.
          </p>
          <GoogleConnectBanner servicio="Drive" />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Solo lectura: desde el portal se navega, se busca, se descarga y se abre
        en Drive. Para subir, mover o borrar se entra en Drive.
      </p>
    </div>
  );
}
