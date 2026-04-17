"use client";

import { cn } from "@/lib/utils";
import { nivelAlerta } from "../services/clasificador-estados";
import { useMinutosDesde } from "../hooks/useCronometroGlobal";
import { useUmbralesAlarma } from "../hooks/useUmbralesAlarma";
import type { NivelAlerta } from "../types";

/** Clases de borde según nivel de alerta. */
export function bordeDeAlerta(nivel: NivelAlerta): string {
  switch (nivel) {
    case "AMBAR":
      return "border-amber-500 border-2";
    case "ROJO":
      return "border-red-500 border-2";
    case "PARPADEO":
      return "border-red-600 border-2 animate-pulse";
    default:
      return "";
  }
}

/** Devuelve el nivel de alerta aplicable a una comanda según enviadoAt. */
export function useNivelAlerta(enviadoAt: string | null | undefined): NivelAlerta {
  const minutos = useMinutosDesde(enviadoAt ?? null);
  const umbrales = useUmbralesAlarma();
  if (!enviadoAt) return "OK";
  return nivelAlerta(minutos, umbrales);
}

/** Wrapper visual opcional que aplica el borde al hijo. */
export function AlertaRetraso({
  enviadoAt,
  className,
  children,
}: {
  enviadoAt: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const nivel = useNivelAlerta(enviadoAt);
  return (
    <div className={cn("rounded-lg", bordeDeAlerta(nivel), className)}>
      {children}
    </div>
  );
}
