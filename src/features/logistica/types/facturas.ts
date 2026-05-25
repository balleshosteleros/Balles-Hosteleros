// Tipos de la entidad Factura de Proveedor (PRP-038).
// Espejo de la tabla public.facturas_proveedor y de la JSONB `lineas`.

export type EstadoFactura =
  | "Borrador"
  | "Analizada"
  | "ConDiscrepancias"
  | "Validada"
  | "Anulada";

export const ESTADOS_FACTURA: EstadoFactura[] = [
  "Borrador",
  "Analizada",
  "ConDiscrepancias",
  "Validada",
  "Anulada",
];

export type OrigenLineaFactura = "albaran" | "ocr" | "manual";

export type DiscrepanciaTipo =
  | "cantidad"
  | "precio"
  | "iva"
  | "importe"
  | "nombre"
  | "formato"
  | "extra"    // existe en factura, no en sistema
  | "faltante"; // existe en sistema, no en factura

export type DiscrepanciaResolucion =
  | "acepto_proveedor"
  | "mantengo_sistema"
  | "editado_manual";

export interface LineaFactura {
  id: string;
  productoId: string | null;
  origen: OrigenLineaFactura;
  nombre: string;
  cantidad: number;
  unidad: string;
  formato: string;
  precioUnitario: number;
  ivaPorcentaje: number;
  importeLinea: number;
  discrepanciaTipo: DiscrepanciaTipo | null;
  discrepanciaResolucion: DiscrepanciaResolucion | null;
  // Cuando origen=ocr, guardamos el valor del sistema para comparar lado-a-lado
  valorSistema?: {
    nombre: string;
    cantidad: number;
    unidad: string;
    formato: string;
    precioUnitario: number;
    ivaPorcentaje: number;
    importeLinea: number;
  } | null;
  orden: number;
}

export interface ComparativaResumen {
  totalLineas: number;
  coincidencias: number;
  diferencias: number;
  extras: number;
  faltantes: number;
  hayAlerta: boolean;
}

export interface ComparativaResultado {
  resumen: ComparativaResumen;
  diferenciaTotal: number; // total proveedor − total sistema
  diferenciaIva: number;
  // las líneas detalladas viven en `facturas_proveedor.lineas`; aquí solo el resumen
}

export interface Factura {
  id: string;
  empresaId: string;
  numeroSecuencial: number;
  numero: string;
  albaranId: string | null;
  proveedorId: string | null;
  proveedorNombre: string;
  numeroFacturaProveedor: string | null;
  fechaFactura: string | null;     // YYYY-MM-DD
  fechaRecepcion: string;          // YYYY-MM-DD
  estado: EstadoFactura;
  baseImponible: number;
  ivaTotal: number;
  total: number;
  lineas: LineaFactura[];
  adjuntoPath: string | null;
  adjuntoMime: string | null;
  adjuntoNombre: string | null;
  ocrResultado: unknown | null;
  ocrTokensInput: number | null;
  ocrTokensOutput: number | null;
  ocrModelo: string | null;
  comparativaResultado: ComparativaResultado | null;
  notas: string | null;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
  validatedBy: string | null;
}

// Resultado crudo del OCR (lo que devuelve Gemini sobre el adjunto del proveedor)
export interface OcrFacturaLinea {
  nombre: string;
  cantidad: number;
  unidad: string;
  formato: string;
  precioUnitario: number;
  ivaPorcentaje: number;
  importeLinea: number;
}

export interface OcrFacturaResultado {
  proveedorNombreDetectado: string | null;
  numeroFacturaDetectado: string | null;
  fechaFacturaDetectada: string | null;
  baseImponibleDetectada: number | null;
  ivaTotalDetectado: number | null;
  totalDetectado: number | null;
  lineas: OcrFacturaLinea[];
  observaciones: string | null;
}
