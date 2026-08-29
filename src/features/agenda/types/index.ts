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

/**
 * El movil lleva WhatsApp; el fijo no. Ya no se adivina mirando si el numero
 * empieza por 6 o 7: el dato manda, cada numero esta en su columna.
 *
 * Aqui solo se normaliza para el enlace de wa.me, que pide el numero con
 * prefijo de pais y sin espacios ni guiones.
 */
export function whatsappHref(movil: string | null): string | null {
  if (!movil) return null;
  let d = movil.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (!d) return null;
  if (/^\d{9}$/.test(d)) d = `34${d}`;
  return `https://wa.me/${d}`;
}
