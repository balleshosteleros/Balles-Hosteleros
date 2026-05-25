import type { TipoProducto } from "@/features/logistica/data/productos";
import type { ProductoInput } from "@/features/logistica/actions/producto-actions";

/**
 * Campos canónicos que la IA puede rellenar en el preview editable.
 * Coincide con ProductoInput pero todo opcional (la IA puede no encontrar valor).
 * `tipo` se inyecta server-side según la vista, no lo pide la IA.
 */
export type CampoProducto =
  | "nombre"
  | "categoria"
  | "estado"
  | "proveedor"
  | "precioCompra"
  | "precioVenta"
  | "coste"
  | "iva"
  | "unidad"
  | "formato"
  | "observaciones"
  | "conservacion"
  | "preparacion";

export const CAMPOS_OBLIGATORIOS_POR_TIPO: Record<TipoProducto, CampoProducto[]> = {
  compra: ["nombre", "categoria", "precioCompra"],
  venta: ["nombre", "categoria", "precioVenta"],
  elaboracion: ["nombre", "categoria", "coste"],
};

export const ETIQUETAS_CAMPOS: Record<CampoProducto, string> = {
  nombre: "Nombre",
  categoria: "Categoría",
  estado: "Estado",
  proveedor: "Proveedor",
  precioCompra: "Precio compra",
  precioVenta: "Precio venta",
  coste: "Coste",
  iva: "IVA",
  unidad: "Unidad",
  formato: "Formato",
  observaciones: "Observaciones",
  conservacion: "Conservación",
  preparacion: "Preparación",
};

/**
 * Una fila sugerida por la IA: valores extraídos + nivel de confianza
 * granular por campo (0-1). El UI usa la confianza para pintar badges
 * verde/ámbar/rojo y para ordenar las celdas que más conviene revisar.
 */
export interface FilaSugerida {
  /** id local para keys de React y trazabilidad cliente; no se persiste. */
  tempId: string;
  /** Valores extraídos. Cualquier campo puede ser null si la IA no lo encontró. */
  valores: Partial<Record<CampoProducto, string | null>>;
  /** Confianza 0-1 por campo. Si falta, asumir 1 (extracción determinista). */
  confianza?: Partial<Record<CampoProducto, number>>;
  /** Notas opcionales por celda (p.ej. "He inferido la categoría de la palabra solomillo"). */
  notas?: Partial<Record<CampoProducto, string>>;
}

export interface AnalisisIAResultado {
  filas: FilaSugerida[];
  /** Aviso global de la IA (p.ej. "He detectado 2 albaranes mezclados; los he unido"). */
  resumen?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  modelo?: string | null;
}

/**
 * Payload extraído del archivo en el cliente y enviado a la server action.
 * - `tabla`: filas ya parseadas de Excel/CSV (IA solo mapea columnas).
 * - `binario`: PDF o imagen en base64 (IA hace OCR + extracción).
 */
export type PayloadExtraido =
  | {
      kind: "tabla";
      nombreArchivo: string;
      cabeceras: string[];
      filas: Array<Record<string, string>>;
    }
  | {
      kind: "binario";
      nombreArchivo: string;
      mimeType: string;
      base64: string;
    };

/**
 * Convierte una FilaSugerida (con todos los campos opcionales) en el
 * ProductoInput definitivo que espera `bulkImportProductos`. Aplica
 * defaults razonables. La validación final la hace el Zod schema server-side.
 */
export function filaToProductoInput(
  fila: FilaSugerida,
  tipo: TipoProducto,
): Partial<ProductoInput> & { tipo: TipoProducto } {
  const v = fila.valores;
  return {
    tipo,
    nombre: (v.nombre ?? "").trim(),
    categoria: (v.categoria ?? "").trim(),
    estado: (v.estado === "Inactivo" ? "Inactivo" : "Activo") as "Activo" | "Inactivo",
    proveedor: v.proveedor ?? null,
    precioCompra: v.precioCompra ?? null,
    precioVenta: v.precioVenta ?? null,
    coste: v.coste ?? null,
    iva: v.iva ?? null,
    unidad: (v.unidad ?? "").trim() || "ud",
    formato: v.formato ?? null,
    observaciones: v.observaciones ?? null,
    conservacion: (v.conservacion ?? null) as ProductoInput["conservacion"],
    preparacion: (v.preparacion ?? null) as ProductoInput["preparacion"],
  };
}
