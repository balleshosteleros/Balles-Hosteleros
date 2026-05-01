import { cn } from "@/lib/utils";
import type { EstadoProceso, GravedadProceso } from "@/features/juridico/data/procesos-juridicos";

const estadoStyles: Record<EstadoProceso, string> = {
  ABIERTO: "bg-status-progress/15 text-status-progress border-status-progress/30",
  CERRADO: "bg-status-done/15 text-status-done border-status-done/30",
};

const gravedadStyles: Record<GravedadProceso, string> = {
  LEVE: "bg-severity-light/15 text-severity-light border-severity-light/30",
  GRAVE: "bg-severity-serious/15 text-severity-serious border-severity-serious/30",
  "MUY GRAVE": "bg-severity-critical/15 text-severity-critical border-severity-critical/30",
};

export function EstadoProcesoBadge({ value }: { value: EstadoProceso }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border", estadoStyles[value])}>
      {value}
    </span>
  );
}

export function GravedadProcesoBadge({ value }: { value: GravedadProceso }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border", gravedadStyles[value])}>
      {value}
    </span>
  );
}
