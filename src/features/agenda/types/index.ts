export const CONTACTO_CATEGORIAS = [
  "mantenimiento",
  "proveedores",
  "proveedores_inactivos",
  "servicios",
  "emergencias",
  "empleados",
  "empleados_inactivos",
  "otros",
] as const;

export type ContactoCategoria = (typeof CONTACTO_CATEGORIAS)[number];

export const CATEGORIA_LABELS: Record<ContactoCategoria, string> = {
  mantenimiento: "Mantenimiento",
  proveedores: "Proveedores",
  proveedores_inactivos: "Proveedores inactivos",
  servicios: "Servicios",
  emergencias: "Emergencias",
  empleados: "Empleados",
  empleados_inactivos: "Empleados inactivos",
  otros: "Otros",
};

export type ContactoOrigen = "manual" | "sistema" | "empleado" | "proveedor";

export interface Contacto {
  id: string;
  empresa_id: string | null;
  nombre: string;
  empresa_contacto: string | null;
  categoria: ContactoCategoria;
  telefono: string | null;
  telefono_fijo: string | null;
  email: string | null;
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
  telefono?: string | null;
  telefono_fijo?: string | null;
  email?: string | null;
  direccion?: string | null;
  notas?: string | null;
}
