/**
 * Catálogo visual de los 11 tipos de bloque (biblioteca del editor).
 */
import {
  Image as ImageIcon,
  LayoutTemplate,
  UtensilsCrossed,
  CalendarCheck,
  Quote,
  MousePointerClick,
  Mail,
  MapPin,
  Rows3,
  Type,
  PlayCircle,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { BloqueTipo } from "../types";

export interface BloqueCatalogoEntrada {
  tipo: BloqueTipo;
  label: string;
  descripcion: string;
  icon: LucideIcon;
}

export const BLOQUES_CATALOGO: BloqueCatalogoEntrada[] = [
  { tipo: "hero", label: "Hero", descripcion: "Imagen + título + CTA", icon: LayoutTemplate },
  { tipo: "galeria", label: "Galería", descripcion: "Grid de imágenes", icon: ImageIcon },
  { tipo: "menu", label: "Menú", descripcion: "Platos de la carta digital", icon: UtensilsCrossed },
  { tipo: "reservas", label: "Reservas", descripcion: "Formulario / embed Cover", icon: CalendarCheck },
  { tipo: "testimonios", label: "Testimonios", descripcion: "Reseñas con estrellas", icon: Quote },
  { tipo: "cta", label: "CTA", descripcion: "Llamada a la acción destacada", icon: MousePointerClick },
  { tipo: "formulario", label: "Formulario", descripcion: "Captura de leads", icon: Mail },
  { tipo: "mapa", label: "Mapa", descripcion: "Ubicación del local", icon: MapPin },
  { tipo: "footer", label: "Footer", descripcion: "Columnas + redes + legal", icon: Rows3 },
  { tipo: "texto_libre", label: "Texto libre", descripcion: "Párrafos con formato", icon: Type },
  { tipo: "video", label: "Video", descripcion: "YouTube / Vimeo / MP4", icon: PlayCircle },
  { tipo: "bolsa_inspectores", label: "Bolsa inspectores", descripcion: "CTA para inscripción de inspectores externos", icon: Briefcase },
];

export function getCatalogo(tipo: BloqueTipo): BloqueCatalogoEntrada {
  const found = BLOQUES_CATALOGO.find((b) => b.tipo === tipo);
  if (!found) throw new Error(`Tipo de bloque desconocido: ${tipo}`);
  return found;
}
