/**
 * Tipos del importador IA de Contabilidad (Facturas y Contactos).
 *
 * Comparte filosofía con el importador de Logística:
 *   - Fila sugerida con `valores` + `confianza` por campo.
 *   - La IA extrae, el usuario revisa y guarda.
 */

import type { PayloadExtraido } from "@/features/logistica/types/importador-ia";

/* ── FACTURAS ─────────────────────────────────────────────── */

export type CampoFactura =
  | "numero"
  | "tipo" // COMPRA | VENTA
  | "contacto_nombre"
  | "fecha"
  | "fecha_vencimiento"
  | "base_imponible"
  | "iva"
  | "total"
  | "estado"
  | "notas";

export const CAMPOS_OBLIGATORIOS_FACTURA: CampoFactura[] = [
  "numero",
  "contacto_nombre",
  "fecha",
  "total",
];

export const ETIQUETAS_CAMPOS_FACTURA: Record<CampoFactura, string> = {
  numero: "Nº factura",
  tipo: "Tipo",
  contacto_nombre: "Cliente / Proveedor",
  fecha: "Fecha emisión",
  fecha_vencimiento: "Fecha vencimiento",
  base_imponible: "Base imponible",
  iva: "IVA",
  total: "Total",
  estado: "Estado",
  notas: "Notas",
};

export const TIPOS_FACTURA = ["COMPRA", "VENTA"] as const;
export const ESTADOS_FACTURA = ["PENDIENTE", "PAGADO", "COBRADO", "VENCIDO"] as const;

export interface FilaFacturaSugerida {
  tempId: string;
  valores: Partial<Record<CampoFactura, string | null>>;
  confianza?: Partial<Record<CampoFactura, number>>;
}

export interface AnalisisFacturasResultado {
  filas: FilaFacturaSugerida[];
  resumen?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  modelo?: string | null;
}

/* ── CONTACTOS ────────────────────────────────────────────── */

export type CampoContacto =
  | "nombre"
  | "tipo" // EMPRESA | AUTONOMO | PARTICULAR
  | "nif"
  | "email"
  | "telefono"
  | "direccion"
  | "categoria"
  | "observaciones";

export const CAMPOS_OBLIGATORIOS_CONTACTO: CampoContacto[] = ["nombre"];

export const ETIQUETAS_CAMPOS_CONTACTO: Record<CampoContacto, string> = {
  nombre: "Nombre",
  tipo: "Tipo",
  nif: "NIF / CIF",
  email: "Email",
  telefono: "Teléfono",
  direccion: "Dirección",
  categoria: "Categoría",
  observaciones: "Observaciones",
};

export const TIPOS_CONTACTO = ["EMPRESA", "AUTONOMO", "PARTICULAR"] as const;

export interface FilaContactoSugerida {
  tempId: string;
  valores: Partial<Record<CampoContacto, string | null>>;
  confianza?: Partial<Record<CampoContacto, number>>;
}

export interface AnalisisContactosResultado {
  filas: FilaContactoSugerida[];
  resumen?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  modelo?: string | null;
}

/* ── Re-export del payload (compartido con logística) ─────── */

export type { PayloadExtraido };
