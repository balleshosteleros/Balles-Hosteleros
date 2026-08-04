import "server-only";

/**
 * OCR EXTRACTIVO de albaranes de proveedor — extractor ÚNICO (PRP-073).
 *
 * Extraído de `asistente-albaran-actions.ts` para que el flujo por importación
 * (OCR desde Storage) y el legado (base64 directo) usen EXACTAMENTE el mismo
 * prompt, schema y normalización. Cuando la recepción contra pedido converja
 * (Fase 6), también consumirá este módulo.
 */

import { randomUUID } from "crypto";
import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";

export interface CabeceraOcrAlbaran {
  proveedor: string | null;
  numero: string | null;
  /** YYYY-MM-DD */
  fecha: string | null;
  total: number | null;
}

/** Línea leída por el OCR de un albarán suelto (incluye datos para el jsonb). */
export interface LineaOcrAlbaran {
  /** id temporal de la línea en el cliente (para casar la resolución). */
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number | null;
  iva?: string | null;
  formato?: string | null;
  unidad: string;
  /** Importe total de la línea tal y como lo imprime el proveedor. */
  importe: number | null;
}

const OCR_ALBARAN_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    proveedorNombreDetectado: { type: SchemaType.STRING, nullable: true },
    numeroAlbaranDetectado: { type: SchemaType.STRING, nullable: true },
    fechaAlbaranDetectada: { type: SchemaType.STRING, nullable: true, description: "YYYY-MM-DD" },
    totalDetectado: { type: SchemaType.NUMBER, nullable: true },
    lineas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          cantidad: { type: SchemaType.NUMBER },
          unidad: { type: SchemaType.STRING },
          formato: { type: SchemaType.STRING },
          precioUnitario: { type: SchemaType.NUMBER },
          ivaPorcentaje: { type: SchemaType.NUMBER },
          importeLinea: { type: SchemaType.NUMBER },
        },
        required: ["nombre", "cantidad"],
      },
    },
  },
  required: ["lineas"],
};

const OCR_ALBARAN_SYSTEM = `
Eres un extractor de albaranes de proveedores de un restaurante en España.
Tu tarea: leer el documento adjunto (foto o PDF de un albarán de entrega) y devolver un JSON con:
- Cabecera: nombre del proveedor, número de albarán, fecha (YYYY-MM-DD) y total del documento.
- Una lista de líneas de PRODUCTO con: nombre tal y como lo escribe el proveedor, cantidad,
  unidad (kg, L, ud, caja...), formato, precio unitario NETO (con descuento aplicado si lo hay),
  IVA % e importe de la línea.
- NO incluyas como líneas los gastos o servicios (portes, desplazamiento, punto verde) ni las
  líneas de regalo sin importe.
- IVA %: SOLO si el documento imprime un porcentaje de IVA explícito (0, 4, 10 o 21). Muchos
  albaranes (p.ej. Makro) imprimen una columna "Imp" con CÓDIGOS de impuesto (1, 2, 5...):
  eso NO es un porcentaje — en ese caso devuelve null.
Si un dato no se ve, devuélvelo como null. NO inventes (ni sabores, ni formatos). Idioma: español.
`.trim();

interface OcrAlbaranRaw {
  proveedorNombreDetectado?: string | null;
  numeroAlbaranDetectado?: string | null;
  fechaAlbaranDetectada?: string | null;
  totalDetectado?: number | null;
  lineas?: Array<{
    nombre?: string;
    cantidad?: number;
    unidad?: string;
    formato?: string;
    precioUnitario?: number;
    ivaPorcentaje?: number;
    importeLinea?: number;
  }>;
}

export type ResultadoOcrAlbaran =
  | { ok: true; cabecera: CabeceraOcrAlbaran; lineas: LineaOcrAlbaran[] }
  | { ok: false; error: "OCR_EMPTY" | "OCR_FAILED"; message: string };

/** Ejecuta el OCR sobre el documento (base64 interno, nunca del body de una request). */
export async function ejecutarOcrAlbaran(input: {
  base64: string;
  mimeType: string;
}): Promise<ResultadoOcrAlbaran> {
  try {
    const ocr = await geminiJSON<OcrAlbaranRaw>(
      "Extrae los datos estructurados de este albarán del proveedor.",
      {
        systemInstruction: OCR_ALBARAN_SYSTEM,
        responseSchema: OCR_ALBARAN_SCHEMA,
        temperature: 0.1,
        attachments: [{ mimeType: input.mimeType || "image/jpeg", base64: input.base64 }],
      },
    );

    const raw = ocr.data ?? {};
    const lineas: LineaOcrAlbaran[] = (raw.lineas ?? [])
      .filter((l) => (l.nombre ?? "").trim() !== "")
      .map((l) => ({
        id: randomUUID(),
        nombre: (l.nombre ?? "").trim(),
        cantidad: Number.isFinite(l.cantidad) ? (l.cantidad as number) : 0,
        precioUnitario: Number.isFinite(l.precioUnitario) ? (l.precioUnitario as number) : null,
        iva: Number.isFinite(l.ivaPorcentaje) ? String(l.ivaPorcentaje) : null,
        formato: (l.formato ?? "").trim() || null,
        unidad: (l.unidad ?? "").trim(),
        importe: Number.isFinite(l.importeLinea) ? (l.importeLinea as number) : null,
      }));

    if (lineas.length === 0) {
      return {
        ok: false,
        error: "OCR_EMPTY",
        message: "La IA no encontró líneas de producto en el documento. Prueba con una foto más nítida.",
      };
    }

    return {
      ok: true,
      cabecera: {
        proveedor: (raw.proveedorNombreDetectado ?? "").trim() || null,
        numero: (raw.numeroAlbaranDetectado ?? "").trim() || null,
        fecha: (raw.fechaAlbaranDetectada ?? "").trim() || null,
        total: Number.isFinite(raw.totalDetectado) ? (raw.totalDetectado as number) : null,
      },
      lineas,
    };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return { ok: false, error: "OCR_FAILED", message: "La IA no está configurada (falta GEMINI_API_KEY)." };
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[ocr-albaran] ejecutarOcrAlbaran:", msg);
    return { ok: false, error: "OCR_FAILED", message: msg };
  }
}
