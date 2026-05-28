"use client";

import * as React from "react";
import { FileText, CheckCircle2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export type FiltroEstado = "activos" | "borradores" | "todos";

interface TabsEstadoProps {
  value: FiltroEstado;
  onChange: (v: FiltroEstado) => void;
  /** Conteo de cada estado para mostrar al lado del tab. */
  counts: {
    activos: number;
    borradores: number;
  };
  className?: string;
}

/**
 * Filtro de 3 estados estándar para las tablas migrables:
 *
 *   [ ✓ Activos (123) ] [ ✎ Borradores (5) ] [ Todos ]
 *
 * Por defecto se abre en "Activos" — los borradores no se mezclan con la operativa.
 * Solo se monta en las 5 entidades migrables (productos, proveedores, empleados,
 * contactos, escandallos).
 */
export function TabsEstado({ value, onChange, counts, className }: TabsEstadoProps) {
  const total = counts.activos + counts.borradores;

  return (
    <div
      role="tablist"
      aria-label="Filtro por estado"
      className={cn("inline-flex items-center gap-1 rounded-md border bg-muted/30 p-1", className)}
    >
      <TabButton
        active={value === "activos"}
        onClick={() => onChange("activos")}
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label="Activos"
        count={counts.activos}
      />
      <TabButton
        active={value === "borradores"}
        onClick={() => onChange("borradores")}
        icon={<FileText className="h-3.5 w-3.5" />}
        label="Borradores"
        count={counts.borradores}
        highlight={counts.borradores > 0}
      />
      <TabButton
        active={value === "todos"}
        onClick={() => onChange("todos")}
        icon={<Layers className="h-3.5 w-3.5" />}
        label="Todos"
        count={total}
      />
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  highlight?: boolean;
}

function TabButton({ active, onClick, icon, label, count, highlight }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-background/60",
      )}
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
          active ? "bg-muted text-foreground" : "bg-transparent",
          highlight && !active && "text-amber-600 dark:text-amber-400",
        )}
      >
        {count}
      </span>
    </button>
  );
}

interface BadgeBorradorProps {
  className?: string;
}

/** Badge gris pequeño para marcar filas de tablas que estén en estado borrador. */
export function BadgeBorrador({ className }: BadgeBorradorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-amber-300/60 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-300",
        className,
      )}
    >
      <FileText className="h-2.5 w-2.5" />
      Borrador
    </span>
  );
}
