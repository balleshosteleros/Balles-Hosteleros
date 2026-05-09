/**
 * Tipos para importación masiva desde Excel/CSV.
 * Cada interfaz representa el shape esperado después del parsing.
 */

import type { ProductoTipo, ProductoEstado, ProveedorEstado } from "./db";

// ─── PROVEEDORES ──────────────────────────────────────────

export interface ProveedorImport {
  nombreComercial: string;
  razonSocial?: string | null;
  cifNif?: string | null;
  categoria: string;
  estado?: ProveedorEstado;
  personaContacto?: string | null;
  telefonoPrincipal?: string | null;
  telefonoSecundario?: string | null;
  telefonoComercial?: string | null;
  emailPrincipal?: string | null;
  emailComercial?: string | null;
  emailPedidos?: string | null;
  emailContabilidad?: string | null;
  web?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  codigoPostal?: string | null;
  diasReparto?: string[];
  horarioReparto?: Record<string, string> | null;
  diasRepartoNegociados?: string[];
  horarioRepartoNegociado?: Record<string, string> | null;
  diaRepartoNegociado?: string | null;
  viaPago?: string | null;
  viaPagoNegociada?: string | null;
  plazoPago?: string | null;
  plazoPagoNegociado?: string | null;
  condicionesPago?: string | null;
  plazoEntrega?: string | null;
  observaciones?: string | null;
  observacionesLogisticas?: string | null;
  comentariosInternos?: string | null;
}

// ─── PRODUCTOS ────────────────────────────────────────────

export interface ProductoImport {
  nombre: string;
  tipo: ProductoTipo;
  categoria: string;
  estado?: ProductoEstado;
  proveedor?: string | null;
  precioCompra?: string | null;
  precioVenta?: string | null;
  coste?: string | null;
  unidad: string;
  unidadUso?: string | null;
  factorConversion?: number;
  stockMinimo?: number;
  stockMaximo?: number;
  agoraId?: string | null;
  observaciones?: string | null;
}

// ─── ESCANDALLOS ──────────────────────────────────────────

/**
 * Formato de entrada de escandallos:
 * Por cada plato (producto venta) se listan sus ingredientes.
 * El parser resuelve los nombres a IDs contra la BD.
 */
export interface EscandalloImport {
  /** Nombre o agora_id del plato (producto tipo venta) */
  productoVenta: string;
  /** Nombre del ingrediente (producto tipo compra) */
  ingrediente: string;
  cantidad: number;
  /** Opcional: si el excel trae la unidad, se usa solo para validación */
  unidad?: string;
  mermaPct?: number;
  observaciones?: string | null;
}

// ─── RESULTADOS DE IMPORTACIÓN ────────────────────────────

export interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  reason: string;
  data?: unknown;
}
