import { cn } from "@/shared/lib/utils";

/**
 * Punto de color determinista por empresa (mismo nombre → mismo color),
 * para que el chip tenga identidad visual sin tener que cargar el logo.
 */
const DOT_COLORS = [
  "hsl(25 80% 55%)", "hsl(280 60% 55%)", "hsl(160 55% 42%)",
  "hsl(340 65% 50%)", "hsl(200 70% 50%)", "hsl(45 80% 48%)",
  "hsl(220 70% 50%)", "hsl(0 65% 50%)",
];

function dotColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % DOT_COLORS.length;
  return DOT_COLORS[h];
}

interface Props {
  /** Nombre de la empresa a mostrar. */
  nombre: string;
  /** Color de marca de la empresa; si no se pasa se deriva del nombre. */
  color?: string | null;
  /** Tamaño del chip. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Chip minimalista de empresa: pill redondeada con un punto de color de marca.
 * Fuente única de estilo — usar SIEMPRE este componente para mostrar el nombre
 * de una empresa como etiqueta (ficha de empleado, Usuarios, Roles, listados…).
 */
export function EmpresaBadge({ nombre, color, size = "md", className }: Props) {
  const dot = color ?? dotColor(nombre);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card font-medium text-foreground/80 leading-none",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        className,
      )}
      title={nombre}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
      />
      <span className="truncate">{nombre}</span>
    </span>
  );
}
