"use client";

import { Check, Cloud, Loader2 } from "lucide-react";

export type EstadoAutosave = "idle" | "dirty" | "saving" | "saved" | "error";

interface Props {
  estado: EstadoAutosave;
  ultimoGuardado: Date | null;
}

export function AutosaveIndicator({ estado, ultimoGuardado }: Props) {
  if (estado === "saving") {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
      </span>
    );
  }
  if (estado === "dirty") {
    return (
      <span className="text-xs text-amber-600 flex items-center gap-1.5">
        <Cloud className="h-3 w-3" /> Cambios sin guardar
      </span>
    );
  }
  if (estado === "error") {
    return (
      <span className="text-xs text-red-600 flex items-center gap-1.5">
        <Cloud className="h-3 w-3" /> Error al guardar
      </span>
    );
  }
  if (estado === "saved" && ultimoGuardado) {
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1.5">
        <Check className="h-3 w-3" /> Guardado{" "}
        {new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(
          ultimoGuardado,
        )}
      </span>
    );
  }
  return null;
}
