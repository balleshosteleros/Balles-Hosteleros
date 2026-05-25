"use client";

import { Check, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Barra flotante que aparece cuando hay un borrador IA pendiente en la
 * pestaña actual. Permite Aceptar (los valores se fijan y deja de marcarse
 * como IA) o Descartar (el estudio vuelve al estado pre-IA).
 *
 * Diseño: sticky bottom, ámbar suave, sólo se renderiza si `activo`.
 */
export function BarraConfirmarIA({
  activo,
  resumen,
  onAceptar,
  onDescartar,
  pending,
}: {
  activo: boolean;
  resumen?: string;
  onAceptar: () => void;
  onDescartar: () => void;
  pending?: boolean;
}) {
  if (!activo) return null;
  return (
    <div className="sticky bottom-3 z-30 mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 text-sm text-amber-900">
        <Sparkles className="h-4 w-4" />
        <span>
          {resumen ?? "Hay sugerencias de IA sin confirmar. Revisa los campos marcados antes de aceptar."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDescartar}
          disabled={pending}
          className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Descartar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onAceptar}
          disabled={pending}
          className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
        >
          <Check className="h-3.5 w-3.5" />
          Aceptar
        </Button>
      </div>
    </div>
  );
}
