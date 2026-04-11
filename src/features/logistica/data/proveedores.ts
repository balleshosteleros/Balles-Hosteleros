// ─── Proveedores data ─────────────────────────────────────

export type EstadoProveedor = "Activo" | "Inactivo" | "Archivado";
export const ESTADOS_PROVEEDOR: EstadoProveedor[] = ["Activo", "Inactivo", "Archivado"];

export const CATEGORIAS_PROVEEDOR = [
  "Cárnicos", "Pescados y mariscos", "Frutas y verduras", "Bebidas",
  "Lácteos", "Congelados", "Limpieza e higiene", "Panadería",
  "Envasados y conservas", "Equipamiento", "Otros",
];

export const DIAS_REPARTO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface Proveedor {
  id: string;
  empresaId: string;
  nombreComercial: string;
  razonSocial: string;
  cifNif: string;
  categoria: string;
  estado: EstadoProveedor;
  observaciones: string;
  // Contacto
  personaContacto: string;
  telefonoPrincipal: string;
  telefonoSecundario: string;
  emailPrincipal: string;
  emailPedidos: string;
  emailIncidencias: string;
  web: string;
  // Dirección
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  codigoPostal: string;
  // Condiciones
  diasReparto: string[];
  condicionesPago: string;
  plazo: string;
  observacionesLogisticas: string;
  comentariosInternos: string;
  // Meta
  creador: string;
  createdAt: string;
  ultimaActualizacion: string;
}

// ─── Accessors ────────────────────────────────────────────
// Datos reales vendrán de Supabase en próxima iteración.
// De momento devolvemos array vacío para que la UI muestre estado "sin datos"
// hasta que se migren los proveedores reales desde la antigua plataforma.

export function getProveedoresPorEmpresa(_empresaId: string): Proveedor[] {
  return [];
}
