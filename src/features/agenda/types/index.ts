export const CONTACTO_CATEGORIAS = [
  "mantenimiento",
  "proveedores",
  "servicios",
  "emergencias",
  "otros",
] as const;

export type ContactoCategoria = (typeof CONTACTO_CATEGORIAS)[number];

export const CATEGORIA_LABELS: Record<ContactoCategoria, string> = {
  mantenimiento: "Mantenimiento",
  proveedores: "Proveedores",
  servicios: "Servicios",
  emergencias: "Emergencias",
  otros: "Otros",
};

export interface Contacto {
  id: string;
  empresa_id: string | null;
  nombre: string;
  empresa_contacto: string | null;
  categoria: ContactoCategoria;
  telefono: string | null;
  email: string | null;
  whatsapp: string | null;
  direccion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ContactoInput {
  nombre: string;
  empresa_contacto?: string | null;
  categoria: ContactoCategoria;
  telefono?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  direccion?: string | null;
  notas?: string | null;
}
