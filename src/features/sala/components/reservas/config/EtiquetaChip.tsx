"use client";

import { cn } from "@/lib/utils";

interface Props {
  nombre: string;
  emoji?: string | null;
  color?: string | null;
  size?: "sm" | "md";
  muted?: boolean;
  className?: string;
}

/**
 * Chip visual de etiqueta con fondo translúcido del color de la etiqueta y
 * borde sólido. Pensado para verse bien sobre claro y oscuro.
 */
export function EtiquetaChip({
  nombre,
  emoji,
  color,
  size = "sm",
  muted = false,
  className,
}: Props) {
  const baseColor = color ?? "#64748b";
  const style = muted
    ? {}
    : {
        backgroundColor: `${baseColor}22`,
        borderColor: `${baseColor}66`,
        color: baseColor,
      };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        muted && "border-muted-foreground/30 text-muted-foreground bg-muted/30",
        className,
      )}
      style={style}
    >
      {emoji ? <span className="leading-none">{emoji}</span> : null}
      <span className="leading-none">{nombre}</span>
    </span>
  );
}
