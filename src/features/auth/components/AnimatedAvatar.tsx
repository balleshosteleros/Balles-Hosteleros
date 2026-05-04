"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnimatedAvatarProps {
  /** Versión IA del avatar (uniforme corporativo). Tiene preferencia. */
  avatarAiUrl?: string | null;
  /** Foto real del empleado (fallback cuando no hay versión IA). */
  avatarUrl?: string | null;
  /** Iniciales para mostrar si no hay ninguna foto. */
  fallback: string;
  /** Texto alternativo (nombre del usuario). */
  alt?: string;
  /** Tamaño en clases tailwind, p.ej. "h-10 w-10". */
  sizeClassName?: string;
  /** Clases extra. */
  className?: string;
  /** Color de fondo del fallback (clase de Tailwind o CSS color). */
  fallbackBg?: string;
  /** Si true, no renderiza el badge de "IA" cuando hay avatarAiUrl. */
  hideAiBadge?: boolean;
  /** Si true, desactiva la animación hover (útil en listas densas). */
  staticHover?: boolean;
}

/**
 * Avatar con animación sutil tipo "tarjeta corporativa":
 * - Hover: ligero zoom + glow.
 * - Si hay versión IA: badge ✦ y animación "breathing" muy suave.
 * - Si solo hay foto real: se muestra tal cual.
 * - Si no hay foto: iniciales con color sólido.
 */
export function AnimatedAvatar({
  avatarAiUrl,
  avatarUrl,
  fallback,
  alt,
  sizeClassName = "h-10 w-10",
  className,
  fallbackBg,
  hideAiBadge = false,
  staticHover = false,
}: AnimatedAvatarProps) {
  const finalUrl = avatarAiUrl ?? avatarUrl ?? null;
  const isAi = !!avatarAiUrl;

  return (
    <div className={cn("relative inline-flex group", className)}>
      <Avatar
        className={cn(
          sizeClassName,
          "ring-1 ring-border transition-all duration-300 ease-out",
          !staticHover && "group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/40 group-hover:shadow-lg group-hover:shadow-primary/20",
          isAi && "animate-breathing",
        )}
      >
        {finalUrl ? <AvatarImage src={finalUrl} alt={alt ?? "Avatar"} /> : null}
        <AvatarFallback
          className={cn("font-bold text-white", fallbackBg ?? "bg-primary")}
          style={!fallbackBg?.startsWith("bg-") ? { backgroundColor: fallbackBg } : undefined}
        >
          {fallback}
        </AvatarFallback>
      </Avatar>

      {isAi && !hideAiBadge && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 ring-2 ring-background shadow-md"
          title="Avatar generado con IA"
          aria-label="Avatar generado con IA"
        >
          <Sparkles className="h-2.5 w-2.5 text-white" />
        </span>
      )}
    </div>
  );
}
