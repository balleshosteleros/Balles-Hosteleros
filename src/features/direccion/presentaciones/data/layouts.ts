import type { Layout, Tono } from "../types/presentaciones";

export const LAYOUTS: { value: Layout; label: string; descripcion: string }[] = [
  { value: "portada", label: "Portada", descripcion: "Título grande + subtítulo" },
  { value: "bullets", label: "Bullets", descripcion: "Título + 3-6 puntos" },
  { value: "cita", label: "Cita", descripcion: "Frase destacada + autor" },
  { value: "comparacion", label: "Comparación", descripcion: "Antes / Después o A vs B" },
  { value: "imagen", label: "Imagen", descripcion: "Título + imagen descriptiva" },
  { value: "cierre", label: "Cierre", descripcion: "Mensaje final + CTA" },
];

export const TONOS: { value: Tono; label: string; descripcion: string }[] = [
  { value: "formal", label: "Formal", descripcion: "Profesional, directo" },
  { value: "cercano", label: "Cercano", descripcion: "Cálido, amigable" },
  { value: "motivacional", label: "Motivacional", descripcion: "Inspirador, energético" },
  { value: "tecnico", label: "Técnico", descripcion: "Preciso, con datos" },
];

export const IDIOMAS: { value: string; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
];

export const TIPOGRAFIAS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Montserrat",
  "Open Sans",
  "Playfair Display",
  "Lora",
  "Merriweather",
] as const;
