"use client";

import * as React from "react";
import { FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BotonesGuardarBorradorProps {
  /** Handler al pulsar "Guardar borrador" — graba con estado `borrador`. Si se omite, no se muestra. */
  onGuardarBorrador?: () => void;
  /** Handler al pulsar "Guardar" definitivo. Lo gestiona el formulario. */
  onGuardar: () => void;
  /** Lista de labels de campos que faltan para poder guardar definitivo. */
  faltantes: string[];
  /** True mientras se está guardando (deshabilita ambos botones). */
  loading?: boolean;
  /** Texto opcional para sobrescribir "Guardar" (ej: "Crear proveedor", "Importar"). */
  labelGuardar?: string;
  /** Si false, el botón borrador no se muestra (entidades no migrables). */
  admiteBorrador?: boolean;
  /** Variante del botón guardar definitivo. */
  variantGuardar?: "default" | "secondary";
}

/**
 * Par de botones estándar para formularios con la regla de "datos completos":
 *
 *   [Guardar borrador]  [Guardar]   ← este último deshabilitado mientras falten campos.
 *
 * El botón "Guardar" muestra tooltip con la lista de campos faltantes.
 * El botón "Guardar borrador" se omite en entidades NO migrables —
 * el resto del software solo permite registros completos.
 */
export function BotonesGuardarBorrador({
  onGuardarBorrador,
  onGuardar,
  faltantes,
  loading = false,
  labelGuardar = "Guardar",
  admiteBorrador = true,
  variantGuardar = "default",
}: BotonesGuardarBorradorProps) {
  const hayFaltantes = faltantes.length > 0;
  const puedeGuardar = !hayFaltantes && !loading;

  return (
    <div className="flex items-center justify-end gap-2">
      {admiteBorrador && onGuardarBorrador && (
        <Button
          type="button"
          variant="outline"
          onClick={onGuardarBorrador}
          disabled={loading}
        >
          <FileText className="h-4 w-4 mr-1.5" />
          Guardar borrador
        </Button>
      )}

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant={variantGuardar}
                onClick={onGuardar}
                disabled={!puedeGuardar}
              >
                <Save className="h-4 w-4 mr-1.5" />
                {loading ? "Guardando…" : labelGuardar}
              </Button>
            </span>
          </TooltipTrigger>
          {hayFaltantes && (
            <TooltipContent side="top" className="max-w-xs">
              <p className="font-semibold text-xs uppercase tracking-wide">
                Faltan {faltantes.length} {faltantes.length === 1 ? "campo" : "campos"}
              </p>
              <ul className="mt-1 text-xs space-y-0.5">
                {faltantes.slice(0, 6).map((label) => (
                  <li key={label}>• {label}</li>
                ))}
                {faltantes.length > 6 && (
                  <li className="italic opacity-70">y {faltantes.length - 6} más…</li>
                )}
              </ul>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
