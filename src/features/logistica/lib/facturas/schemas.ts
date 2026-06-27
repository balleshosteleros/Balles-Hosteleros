import { z } from "zod";

// Schemas Zod paralelos a src/features/logistica/types/facturas.ts.
// Se usan para validar inputs/outputs de server actions y respuestas OCR.

export const estadoFacturaSchema = z.enum(["Pendiente", "Confirmada"]);

export const origenLineaSchema = z.enum(["albaran", "ocr", "manual"]);

export const discrepanciaTipoSchema = z.enum([
  "cantidad",
  "precio",
  "iva",
  "importe",
  "nombre",
  "formato",
  "extra",
  "faltante",
]);

export const discrepanciaResolucionSchema = z.enum([
  "acepto_proveedor",
  "mantengo_sistema",
  "editado_manual",
]);

export const valorSistemaSchema = z.object({
  nombre: z.string(),
  cantidad: z.number(),
  unidad: z.string(),
  formato: z.string(),
  precioUnitario: z.number(),
  ivaPorcentaje: z.number(),
  importeLinea: z.number(),
});

export const lineaFacturaSchema = z.object({
  id: z.string(),
  productoId: z.string().guid().nullable(),
  origen: origenLineaSchema,
  nombre: z.string().min(1),
  cantidad: z.number().nonnegative(),
  unidad: z.string(),
  formato: z.string(),
  precioUnitario: z.number().nonnegative(),
  ivaPorcentaje: z.number().min(0).max(100),
  importeLinea: z.number(),
  discrepanciaTipo: discrepanciaTipoSchema.nullable(),
  discrepanciaResolucion: discrepanciaResolucionSchema.nullable(),
  valorSistema: valorSistemaSchema.nullable().optional(),
  orden: z.number().int().nonnegative(),
});

// ─── OCR response schema ──────────────────────────────────
// Este shape es lo que pedimos a Gemini en `responseSchema` (con tolerancia a nulls).

export const ocrFacturaLineaSchema = z.object({
  nombre: z.string(),
  cantidad: z.number(),
  unidad: z.string(),
  formato: z.string(),
  precioUnitario: z.number(),
  ivaPorcentaje: z.number(),
  importeLinea: z.number(),
});

export const ocrFacturaResultadoSchema = z.object({
  proveedorNombreDetectado: z.string().nullable(),
  numeroFacturaDetectado: z.string().nullable(),
  fechaFacturaDetectada: z.string().nullable(),
  baseImponibleDetectada: z.number().nullable(),
  ivaTotalDetectado: z.number().nullable(),
  totalDetectado: z.number().nullable(),
  lineas: z.array(ocrFacturaLineaSchema),
  observaciones: z.string().nullable(),
});

// ─── Inputs de server actions ─────────────────────────────

export const crearFacturaDesdeAlbaranInputSchema = z.object({
  albaranId: z.string().guid(),
});

export const crearFacturaHuerfanaInputSchema = z.object({
  proveedorId: z.string().guid().nullable(),
  proveedorNombre: z.string().min(1),
  fechaFactura: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export const resolverDiscrepanciaInputSchema = z.object({
  facturaId: z.string().guid(),
  lineaId: z.string(),
  resolucion: discrepanciaResolucionSchema,
  cantidad: z.number().optional(),
  precioUnitario: z.number().optional(),
  ivaPorcentaje: z.number().optional(),
});

export const validarFacturaInputSchema = z.object({
  facturaId: z.string().guid(),
  notas: z.string().nullable().optional(),
});

export type CrearFacturaDesdeAlbaranInput = z.infer<typeof crearFacturaDesdeAlbaranInputSchema>;
export type CrearFacturaHuerfanaInput = z.infer<typeof crearFacturaHuerfanaInputSchema>;
export type ResolverDiscrepanciaInput = z.infer<typeof resolverDiscrepanciaInputSchema>;
export type ValidarFacturaInput = z.infer<typeof validarFacturaInputSchema>;
export type OcrFacturaResultadoZod = z.infer<typeof ocrFacturaResultadoSchema>;
