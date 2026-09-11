import { Sprout, Zap, Shield, Award, Crown, Trophy, Star, Hourglass } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * El dibujo de cada nivel. El nivel guarda el NOMBRE del icono en
 * `badgeIcon` (columna `toques_niveles.badge_icon`), y aquí se traduce al
 * dibujo. Fuente única: la insignia tiene que ser la misma en la píldora de
 * arriba, en la tarjeta de saldo, en el camino de niveles y en la clasificación.
 */
const ICONOS: Record<string, LucideIcon> = {
  Hourglass,
  Sprout,
  Zap,
  Shield,
  Award,
  Crown,
  Trophy,
  Star,
};

export function iconoDeNivel(badgeIcon: string | null | undefined): LucideIcon {
  if (!badgeIcon) return Trophy;
  return ICONOS[badgeIcon] ?? Trophy;
}

/** Color de respaldo cuando el nivel no trae el suyo. */
export const COLOR_NIVEL_POR_DEFECTO = "#9ca3af";
