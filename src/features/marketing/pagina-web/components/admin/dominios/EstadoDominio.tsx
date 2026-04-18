"use client";

import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { DominioEstado } from "../../../types";

const LABEL: Record<DominioEstado, string> = {
  PENDIENTE_DNS: "Pendiente DNS",
  VERIFICADO: "Verificado",
  ERROR: "Error",
};

const CLASS: Record<DominioEstado, string> = {
  PENDIENTE_DNS: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  VERIFICADO: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function EstadoDominio({
  estado,
  ssl,
}: {
  estado: DominioEstado;
  ssl: boolean;
}) {
  const Icon =
    estado === "VERIFICADO" ? CheckCircle2 : estado === "ERROR" ? AlertCircle : Clock;
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={CLASS[estado]}>
        <Icon className="h-3 w-3 mr-1" /> {LABEL[estado]}
      </Badge>
      {ssl && (
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          SSL
        </Badge>
      )}
    </div>
  );
}
