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

/**
 * Los colores que trae cada nivel son pastel, pensados para manchas grandes. En
 * una insignia de 30 píxeles se quedaban lavados y no se veía de qué nivel era.
 * Aquí se convierten en un par de tonos VIVOS (uno claro arriba, otro más hondo
 * abajo) para el degradado de la insignia: mismo color, con fuerza.
 */
export function tonosDeInsignia(hex: string): { claro: string; hondo: string } {
  const { h, s, l } = aHsl(hex);
  const sat = Math.min(100, Math.max(55, s * 1.55));
  return {
    claro: `hsl(${h} ${sat}% ${Math.min(72, Math.max(48, l * 0.92))}%)`,
    hondo: `hsl(${h} ${sat}% ${Math.min(58, Math.max(32, l * 0.66))}%)`,
  };
}

function aHsl(hex: string): { h: number; s: number; l: number } {
  const limpio = hex.replace("#", "").trim();
  const completo =
    limpio.length === 3
      ? limpio.split("").map((c) => c + c).join("")
      : limpio.padEnd(6, "0").slice(0, 6);
  const r = parseInt(completo.slice(0, 2), 16) / 255;
  const g = parseInt(completo.slice(2, 4), 16) / 255;
  const b = parseInt(completo.slice(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return { h: 220, s: 10, l: 60 };

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: s * 100, l: l * 100 };
}
