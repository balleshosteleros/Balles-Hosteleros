import { cn } from "@/lib/utils";
import type { EstadoProceso, GravedadProceso } from "@/data/procesos-juridicos";

const estadoStyles: Record<EstadoProceso, string> = {
  "EN PROCESO": "bg-status-progress/15 text-status-progress border-status-progress/30",
  PENDIENTE: "bg-status-pending/15 text-status-pending border-status-pending/30",
  REVISIÓN: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  ESCALADO: "bg-status-escalated/15 text-status-escalated border-status-escalated/30",
  CERRADO: "bg-status-done/15 text-status-done border-status-done/30",
  ARCHIVADO: "bg-muted text-muted-foreground border-border",
};

const gravedadStyles: Record<GravedadProceso, string> = {
  LEVE: "bg-severity-light/15 text-severity-light border-severity-light/30",
  MEDIA: "bg-severity-improvement/15 text-severity-improvement border-severity-improvement/30",
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
