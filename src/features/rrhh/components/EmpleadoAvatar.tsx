"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Foto de un empleado, o sus iniciales sobre un color si no la tiene.
 *
 * El color de las iniciales sale del propio nombre, así que la misma persona
 * sale siempre del mismo color y se la reconoce de un vistazo aunque no haya
 * subido foto.
 */

const AVATAR_COLORS = [
  "hsl(var(--primary))",
  "hsl(25 80% 55%)",
  "hsl(280 60% 55%)",
  "hsl(160 55% 42%)",
  "hsl(340 65% 50%)",
  "hsl(200 70% 50%)",
  "hsl(45 80% 48%)",
  "hsl(0 65% 50%)",
];

/** Color estable a partir de un texto (el nombre o el id del empleado). */
export function avatarColor(clave: string): string {
  let h = 0;
  for (let i = 0; i < clave.length; i++) h = (h + clave.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

/** Dos letras a partir del nombre completo. */
export function iniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

interface Props {
  nombre: string;
  avatarUrl?: string | null;
  /** Clave para el color de las iniciales. Por defecto, el nombre. */
  claveColor?: string;
  className?: string;
  /** Tamaño del texto de las iniciales; se ajusta al tamaño del avatar. */
  textoClassName?: string;
}

export function EmpleadoAvatar({
  nombre,
  avatarUrl,
  claveColor,
  className,
  textoClassName,
}: Props) {
  return (
    <Avatar className={cn("h-6 w-6", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={nombre} className="object-cover" /> : null}
      <AvatarFallback
        className={cn("font-semibold text-white", textoClassName ?? "text-[9px]")}
        style={{ backgroundColor: avatarColor(claveColor ?? nombre) }}
      >
        {iniciales(nombre)}
      </AvatarFallback>
    </Avatar>
  );
}
