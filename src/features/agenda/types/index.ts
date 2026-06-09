export const CONTACTO_CATEGORIAS = [
  "mantenimiento",
  "proveedores",
  "servicios",
  "emergencias",
  "empleados",
  "otros",
] as const;

export type ContactoCategoria = (typeof CONTACTO_CATEGORIAS)[number];

export const CATEGORIA_LABELS: Record<ContactoCategoria, string> = {
  mantenimiento: "Mantenimiento",
  proveedores: "Proveedores",
  servicios: "Servicios",
  emergencias: "Emergencias",
  empleados: "Empleados",
  otros: "Otros",
};

export const ETIQUETA_COLORES = [
  "slate",
  "amber",
  "blue",
  "violet",
  "red",
  "emerald",
  "pink",
  "orange",
] as const;

export type EtiquetaColor = (typeof ETIQUETA_COLORES)[number];

export interface Etiqueta {
  id: string;
  empresa_id: string | null;
  categoria: ContactoCategoria;
  nombre: string;
  color: EtiquetaColor;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface EtiquetaInput {
  categoria: ContactoCategoria;
  nombre: string;
  color: EtiquetaColor;
}

export type ContactoOrigen = "manual" | "sistema" | "empleado" | "proveedor";

export interface Contacto {
  id: string;
  empresa_id: string | null;
  nombre: string;
  empresa_contacto: string | null;
  categoria: ContactoCategoria;
  etiqueta_id: string | null;
  telefono: string | null;
  email: string | null;
  whatsapp: string | null;
  direccion: string | null;
  notas: string | null;
  origen: ContactoOrigen;
  protegido: boolean;
  activo: boolean;
  estado_origen: string | null;
  empleado_id: string | null;
  proveedor_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ContactoInput {
  nombre: string;
  empresa_contacto?: string | null;
  categoria: ContactoCategoria;
  etiqueta_id?: string | null;
  telefono?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  direccion?: string | null;
  notas?: string | null;
}
