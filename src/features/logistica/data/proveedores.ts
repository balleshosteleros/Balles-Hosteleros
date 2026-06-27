// ─── Proveedores data ─────────────────────────────────────

export type EstadoProveedor = "Activo" | "Inactivo" | "Borrador";
export const ESTADOS_PROVEEDOR: EstadoProveedor[] = ["Activo", "Inactivo", "Borrador"];

export const CATEGORIAS_PROVEEDOR = [
  "Cárnicos", "Pescados y mariscos", "Frutas y verduras", "Bebidas",
  "Lácteos", "Congelados", "Limpieza e higiene", "Panadería",
  "Envasados y conservas", "Equipamiento", "Otros",
];

export const DIAS_REPARTO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const VIAS_PAGO = ["Efectivo", "Tarjeta", "Transferencia", "SEPA", "Otro"] as const;
export type ViaPago = typeof VIAS_PAGO[number];

export const PLAZOS_PAGO = [
  "Un día antes del reparto",
  "El día del reparto",
  "7 días",
  "15 días",
  "30 días",
  "60 días",
  "Otro",
] as const;
export type PlazoPago = typeof PLAZOS_PAGO[number];

export const FRANJAS_REPARTO = [
  "Mañana (09:00-15:00)",
  "Tarde (15:00-20:00)",
  "Personalizado",
] as const;

export interface Proveedor {
  id: string;
  numeroSecuencial?: number;
  empresaId: string;
  nombreComercial: string;
  razonSocial: string;
  cifNif: string;
  categoria: string;
  estado: EstadoProveedor;
  observaciones: string;
  // Contacto empresa
  telefonoPrincipal: string;
  emailPrincipal: string;
  web: string;
  // Comercial asignado
  personaContacto: string;
  telefonoComercial: string;
  emailComercial: string;
  // Otros correos operativos
  emailPedidos: string;
  emailContabilidad: string;
  // Legacy: teléfono secundario (mantenido para compat de importación)
  telefonoSecundario: string;
  // Dirección
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  codigoPostal: string;
  // Pago (estructurado)
  viaPago: string;
  viaPagoNegociada: string;
  plazoPago: string;
  plazoPagoNegociado: string;
  // Reparto genérico del proveedor
  diasReparto: string[];
  horarioReparto: Record<string, string>;
  // Reparto negociado con nosotros (lo que la ficha de pedido usará para fijar día/hora)
  diasRepartoNegociados: string[];
  horarioRepartoNegociado: Record<string, string>;
  /** Día principal de reparto: el que los pedidos cogen por defecto. */
  diaRepartoPrincipal: string;
  // Legacy free-text (mantenidos para compatibilidad de importación / lectura)
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
