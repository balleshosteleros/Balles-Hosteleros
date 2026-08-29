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
  email?: string | null;
  direccion?: string | null;
  notas?: string | null;
}

/**
 * WhatsApp se deduce del telefono: no hay campo aparte porque en la practica
 * siempre era el mismo numero y nadie lo rellenaba nunca.
 *
 * Solo los moviles (6 / 7) llevan WhatsApp. Los fijos y los cortos de
 * emergencias (112, 091, 080...) no: ahi el boton solo llevaria a un chat que
 * no existe.
 *
 * Muchos contactos traen dos numeros en el mismo campo ("914842079 - 678843998",
 * "600918698/677947292"), asi que se parte y se coge el primer movil que haya.
 */
export function whatsappDesdeTelefono(telefono: string | null): string | null {
  if (!telefono) return null;
  for (const parte of telefono.split(/[^\d+]+/)) {
    let d = parte.replace(/[^\d]/g, "");
    if (!d) continue;
    if (d.startsWith("00")) d = d.slice(2);
    if (/^[67]\d{8}$/.test(d)) return `34${d}`;
    if (/^34[67]\d{8}$/.test(d)) return d;
  }
  return null;
}
