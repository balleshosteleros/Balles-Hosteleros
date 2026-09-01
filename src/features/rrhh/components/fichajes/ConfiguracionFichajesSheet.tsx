"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { FichajesConfigPanel } from "@/features/ajustes/components/FichajesConfigPanel";

/**
 * CONFIGURACIÓN del submódulo Fichajes (engranaje superior derecho), no Ajustes
 * generales: son dos niveles distintos y quien gestiona fichajes a diario no
 * tiene por qué tener acceso a Ajustes.
 *
 * Reutiliza `FichajesConfigPanel`, que es la configuración REAL (lee y guarda en
 * `empresa_fichajes_config`). Antes el engranaje abría un diálogo propio de tres
 * campos que no cargaba ni guardaba nada.
 *
 * Mismo patrón visual que `ConfiguracionHorariosSheet`: vista a pantalla
 * completa dentro del contenido, con cabecera y botón de volver.
 */
export function ConfiguracionFichajesSheet({ onVolver }: { onVolver: () => void }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <Button variant="outline" size="sm" onClick={onVolver} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Volver a fichajes
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">
            Configuración de fichajes
          </h2>
          <p className="text-sm text-muted-foreground leading-tight">
            Márgenes respecto al turno, avisos, auto-salida y cierre de jornadas abiertas.
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="max-w-2xl">
          <FichajesConfigPanel embedded />
        </div>
      </div>
    </div>
  );
}
