/**
 * Tipos de dominio alineados 1:1 con el esquema de Supabase
 * (migración .claude/migrations/001_logistica.sql).
 *
 * Estos son los "Row types" — reflejan las columnas tal cual están en la BD.
 * Para los tipos de UI usar los de `data/` que están en camelCase.
 */

// ─── ENUMS ────────────────────────────────────────────────

export type ProductoTipo = "compra" | "venta" | "elaboracion";
export type ProductoEstado = "Activo" | "Inactivo";
export type ProveedorEstado = "Activo" | "Inactivo" | "Archivado";
export type AlbaranEstado = "Pendiente" | "Confirmado" | "Recibido" | "Facturado" | "Archivado";

// ─── PRODUCTOS ────────────────────────────────────────────

export interface ProductoRow {
  id: string;
  empresa_id: string | null;
  tipo: ProductoTipo;
  nombre: string;
  categoria: string;
  estado: ProductoEstado;
  proveedor: string | null;
  precio_compra: string | null;
  coste: string | null;
  unidad: string;
  unidad_uso: string | null;
  factor_conversion: number;
  stock_minimo: number;
  stock_maximo: number;
  precio_venta: string | null;
  agora_id: string | null;
  ventas_dia_promedio: number;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── STOCK ────────────────────────────────────────────────

export interface StockRow {
  id: string;
  empresa_id: string;
  producto_id: string | null;
  producto_nombre: string;
  cantidad_actual: number;
  cantidad_minima: number;
  cantidad_maxima: number;
  unidad: string;
  ubicacion: string | null;
  ultimo_movimiento: string | null;
  created_at: string;
}

// ─── PROVEEDORES ──────────────────────────────────────────

export interface ProveedorRow {
  id: string;
  empresa_id: string;
  nombre_comercial: string;
  razon_social: string | null;
  cif_nif: string | null;
  categoria: string;
  estado: ProveedorEstado;
  persona_contacto: string | null;
  telefono_principal: string | null;
  telefono_secundario: string | null;
  telefono_comercial: string | null;
  email_principal: string | null;
  email_comercial: string | null;
  email_pedidos: string | null;
  email_contabilidad: string | null;
  web: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  codigo_postal: string | null;
  dias_reparto: string[];
  horario_reparto: Record<string, string> | null;
  dias_reparto_negociados: string[];
  horario_reparto_negociado: Record<string, string> | null;
  dia_reparto_negociado: string | null;
  via_pago: string | null;
  via_pago_negociada: string | null;
  plazo_pago: string | null;
  plazo_pago_negociado: string | null;
  condiciones_pago: string | null;
  plazo_entrega: string | null;
  observaciones: string | null;
  observaciones_logisticas: string | null;
  comentarios_internos: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── INGREDIENTES-PROVEEDOR ───────────────────────────────

export interface IngredienteProveedorRow {
  id: string;
  producto_id: string;
  proveedor_id: string;
  precio_unitario: number;
  referencia: string | null;
  es_preferido: boolean;
  ultimo_precio_fecha: string | null;
  created_at: string;
  updated_at: string;
}

// ─── ESCANDALLOS ──────────────────────────────────────────

export interface EscandalloRow {
  id: string;
  producto_venta_id: string;
  ingrediente_id: string;
  cantidad: number;
  merma_pct: number;
  observaciones: string | null;
  created_at: string;
}

// ─── STOCK TEMPORADA ──────────────────────────────────────

export interface StockTemporadaRow {
  id: string;
  empresa_id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  created_at: string;
  updated_at: string;
}

export interface StockTemporadaReglaRow {
  id: string;
  temporada_id: string;
  producto_id: string;
  stock_maximo: number;
  stock_minimo: number;
}

// ─── ALBARANES ────────────────────────────────────────────

export interface AlbaranRow {
  id: string;
  empresa_id: string;
  proveedor_id: string;
  numero: string;
  fecha: string;
  estado: AlbaranEstado;
  pedido_id: string | null;
  factura_ref: string | null;
  dto_pct: number;
  dto_eur: number;
  notas: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlbaranLineaRow {
  id: string;
  albaran_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  impuesto_pct: number;
  dto_pct: number;
  dto_eur: number;
}

// ─── FUNCIONES SQL (RPC) ──────────────────────────────────

/** Output de la función calcular_necesidad_compra(p_empresa_id) */
export interface NecesidadCompraRow {
  producto_id: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  stock_objetivo: number;
  necesidad: number;
  proveedor_preferido: string | null;
  proveedor_nombre: string | null;
  precio_estimado: number | null;
  coste_estimado: number;
}
