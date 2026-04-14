import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza texto: primera letra mayúscula, el resto minúsculas.
 * Ej: "HOLA MUNDO" → "Hola mundo" | "hola" → "Hola"
 * Se aplica en formularios y server actions para todos los campos de texto libre.
 */
export function capitalizeText(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
