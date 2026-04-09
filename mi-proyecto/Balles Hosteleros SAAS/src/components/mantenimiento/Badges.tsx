import { cn } from "@/lib/utils";
import { Estado, Gravedad } from "@/data/mantenimiento";

const estadoStyles: Record<Estado, string> = {
  PENDIENTE: "bg-status-pending/15 text-status-pending border-status-pending/30",
  "EN PROGRESO": "bg-status-progress/15 text-status-progress border-status-progress/30",
  ESCALADO: "bg-status-escalated/15 text-status-escalated border-status-escalated/30",
  TERMINADO: "bg-status-done/15 text-status-done border-status-done/30",
};

const gravedadStyles: Record<Gravedad, string> = {
  LEVE: "bg-severity-light/15 text-severity-light border-severity-light/30",
  MEJORA: "bg-severity-improvement/15 text-severity-improvement border-severity-improvement/30",
  GRAVE: "bg-severity-serious/15 text-severity-serious border-severity-serious/30",
  "MUY GRAVE": "bg-severity-critical/15 text-severity-critical border-severity-critical/30",
};

export function StatusBadge({ value }: { value: Estado }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border", estadoStyles[value])}>
      {value}
    </span>
  );
}

export function GravedadBadge({ value }: { value: Gravedad }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border", gravedadStyles[value])}>
      {value}
    </span>
  );
}
